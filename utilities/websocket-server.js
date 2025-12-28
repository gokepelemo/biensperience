/**
 * WebSocket Server for Real-Time Event Synchronization
 *
 * Provides real-time event broadcasting for collaborative plan editing.
 * Works with the client-side WebSocketTransport in event-transport.js.
 *
 * Features:
 * - Experience and Plan room management with permission validation
 * - Room membership restricted to owner and collaborators only
 * - User presence tracking (join/leave notifications)
 * - Event broadcasting to room members (excluding sender)
 * - JWT-based authentication
 * - Heartbeat/ping-pong for connection health
 * - Rate limiting per connection
 * - Message size limits
 * - Connection limits per user
 *
 * Room Types:
 * - experience:{experienceId} - Owner and collaborators of an experience
 * - plan:{planId} - Owner and collaborators of a specific plan
 *
 * @module websocket-server
 */

const WebSocket = require('ws');
const url = require('url');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const backendLogger = require('./backend-logger');

/**
 * Cache for user profile visibility to avoid repeated DB queries
 * Key: userId (string), Value: { visibility: string, cachedAt: number }
 * @type {Map<string, object>}
 */
const userVisibilityCache = new Map();

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const VISIBILITY_CACHE_TTL = 5 * 60 * 1000;

// =====================
// Rate Limiting Config
// =====================

/**
 * Maximum messages per window per connection
 * Configurable via WS_RATE_MAX env var
 */
const RATE_LIMIT_MAX = parseInt(process.env.WS_RATE_MAX || '', 10) || 100;

/**
 * Rate limit window in milliseconds
 * Configurable via WS_RATE_WINDOW_MS env var
 */
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.WS_RATE_WINDOW_MS || '', 10) || 60000;

/**
 * Maximum message size in bytes (64KB default)
 * Configurable via WS_MAX_MESSAGE_SIZE env var
 */
const MAX_MESSAGE_SIZE = parseInt(process.env.WS_MAX_MESSAGE_SIZE || '', 10) || 65536;

/**
 * Maximum connections per user (5 default - allows multiple tabs/devices)
 * Configurable via WS_MAX_CONNECTIONS_PER_USER env var
 */
const MAX_CONNECTIONS_PER_USER = parseInt(process.env.WS_MAX_CONNECTIONS_PER_USER || '', 10) || 5;

/**
 * User connection tracking: userId -> Set of WebSocket connections
 * @type {Map<string, Set<WebSocket>>}
 */
const userConnections = new Map();

/**
 * Validate if a string is a valid MongoDB ObjectId
 * Prevents NoSQL injection by ensuring IDs are properly formatted
 *
 * @param {string} id - The ID to validate
 * @returns {boolean} True if valid ObjectId format
 */
function isValidObjectId(id) {
  if (!id || typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id) && /^[a-fA-F0-9]{24}$/.test(id);
}

/**
 * Check if a user has private profile visibility
 * Uses caching to avoid repeated DB queries
 *
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} True if user has private profile
 */
async function hasPrivateProfile(userId) {
  if (!userId) return false;

  const userIdStr = userId.toString();

  // Check cache first
  const cached = userVisibilityCache.get(userIdStr);
  if (cached && (Date.now() - cached.cachedAt) < VISIBILITY_CACHE_TTL) {
    return cached.visibility === 'private';
  }

  try {
    const User = mongoose.model('User');
    const user = await User.findById(userIdStr, 'preferences.profileVisibility visibility').lean();

    if (!user) {
      // User not found - don't cache, return false
      return false;
    }

    // Check preferences.profileVisibility first (newer), fall back to visibility field
    const visibility = user.preferences?.profileVisibility || user.visibility || 'public';

    // Cache the result
    userVisibilityCache.set(userIdStr, {
      visibility,
      cachedAt: Date.now()
    });

    return visibility === 'private';
  } catch (error) {
    backendLogger.error('[WebSocket] Error checking profile visibility', {
      userId: userIdStr,
      error: error.message
    }, error);
    return false; // Default to not private on error
  }
}

/**
 * Invalidate visibility cache for a user
 * Called when user updates their profile visibility preference
 *
 * @param {string} userId - User ID to invalidate
 */
function invalidateVisibilityCache(userId) {
  if (userId) {
    userVisibilityCache.delete(userId.toString());
  }
}

/**
 * Check rate limit for a connection
 * Uses sliding window algorithm
 *
 * @param {object} client - Client info object
 * @returns {boolean} True if within rate limit, false if exceeded
 */
function checkRateLimit(client) {
  const now = Date.now();

  // Initialize rate limit tracking if not exists
  if (!client.rateLimitWindow) {
    client.rateLimitWindow = now;
    client.messageCount = 0;
  }

  // Reset window if expired
  if (now - client.rateLimitWindow > RATE_LIMIT_WINDOW_MS) {
    client.rateLimitWindow = now;
    client.messageCount = 0;
  }

  // Increment and check
  client.messageCount++;

  if (client.messageCount > RATE_LIMIT_MAX) {
    backendLogger.warn('[WebSocket] Rate limit exceeded', {
      userId: client.userId,
      sessionId: client.sessionId,
      messageCount: client.messageCount,
      window: RATE_LIMIT_WINDOW_MS
    });
    return false;
  }

  return true;
}

/**
 * Track user connection and check limit
 *
 * @param {string} userId - User ID
 * @param {WebSocket} ws - WebSocket connection
 * @returns {boolean} True if connection allowed, false if limit exceeded
 */
function trackUserConnection(userId, ws) {
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }

  const connections = userConnections.get(userId);

  // Check limit
  if (connections.size >= MAX_CONNECTIONS_PER_USER) {
    backendLogger.warn('[WebSocket] Connection limit exceeded for user', {
      userId,
      currentConnections: connections.size,
      maxAllowed: MAX_CONNECTIONS_PER_USER
    });
    return false;
  }

  connections.add(ws);
  return true;
}

/**
 * Remove user connection from tracking
 *
 * @param {string} userId - User ID
 * @param {WebSocket} ws - WebSocket connection
 */
function removeUserConnection(userId, ws) {
  const connections = userConnections.get(userId);
  if (connections) {
    connections.delete(ws);
    if (connections.size === 0) {
      userConnections.delete(userId);
    }
  }
}

/**
 * Room management: planId -> Set of WebSocket connections
 * @type {Map<string, Set<WebSocket>>}
 */
const rooms = new Map();

/**
 * User tracking: WebSocket -> user info
 * @type {Map<WebSocket, object>}
 */
const clients = new Map();

/**
 * Heartbeat interval in milliseconds
 */
const HEARTBEAT_INTERVAL = 30000;

/**
 * Connection timeout after missed pings
 */
const CONNECTION_TIMEOUT = 35000;

/**
 * Validate if a user is an owner or collaborator of an experience
 *
 * @param {string} userId - User ID to check
 * @param {string} experienceId - Experience ID to check
 * @returns {Promise<boolean>} True if user is owner or collaborator
 */
async function isExperienceMember(userId, experienceId) {
  try {
    // Validate IDs to prevent NoSQL injection
    if (!isValidObjectId(userId) || !isValidObjectId(experienceId)) {
      backendLogger.warn('[WebSocket] Invalid ObjectId in experience membership check', {
        userId,
        experienceId,
        validUserId: isValidObjectId(userId),
        validExperienceId: isValidObjectId(experienceId)
      });
      return false;
    }

    const Experience = mongoose.model('Experience');
    const Plan = mongoose.model('Plan');
    
    const experience = await Experience.findById(experienceId, 'permissions').lean();

    if (!experience) {
      backendLogger.debug('[WebSocket] Experience not found', { experienceId });
      return false;
    }

    // Check if user is in permissions array with owner, collaborator, or contributor role
    const hasPermission = experience.permissions?.some(p =>
      p.entity === 'user' &&
      p._id?.toString() === userId?.toString() &&
      (p.type === 'owner' || p.type === 'collaborator' || p.type === 'contributor')
    );

    // Also check if user has an active plan for this experience
    // This handles cases where contributor permission wasn't added yet
    let hasPlan = false;
    if (!hasPermission) {
      const planCount = await Plan.countDocuments({
        experience: experienceId,
        'permissions._id': userId,
        'permissions.entity': 'user',
        'permissions.type': { $in: ['owner', 'collaborator'] }
      });
      hasPlan = planCount > 0;
    }

    const isMember = hasPermission || hasPlan;

    backendLogger.debug('[WebSocket] Experience membership check', {
      userId,
      experienceId,
      hasPermission,
      hasPlan,
      isMember,
      permissionCount: experience.permissions?.length || 0
    });

    return isMember;
  } catch (error) {
    backendLogger.error('[WebSocket] Error checking experience membership', {
      userId,
      experienceId,
      error: error.message
    }, error);
    return false;
  }
}

/**
 * Validate if a user is an owner or collaborator of a plan
 *
 * @param {string} userId - User ID to check
 * @param {string} planId - Plan ID to check
 * @returns {Promise<boolean>} True if user is owner or collaborator
 */
async function isPlanMember(userId, planId) {
  try {
    // Validate IDs to prevent NoSQL injection
    if (!isValidObjectId(userId) || !isValidObjectId(planId)) {
      backendLogger.warn('[WebSocket] Invalid ObjectId in plan membership check', {
        userId,
        planId,
        validUserId: isValidObjectId(userId),
        validPlanId: isValidObjectId(planId)
      });
      return false;
    }

    const Plan = mongoose.model('Plan');
    const plan = await Plan.findById(planId, 'permissions user').lean();

    if (!plan) {
      backendLogger.debug('[WebSocket] Plan not found', { planId });
      return false;
    }

    // Plan owner (the user field) is always a member
    if (plan.user?.toString() === userId?.toString()) {
      return true;
    }

    // Check if user is in permissions array with owner or collaborator role
    const isMember = plan.permissions?.some(p =>
      p.entity === 'user' &&
      p._id?.toString() === userId?.toString() &&
      (p.type === 'owner' || p.type === 'collaborator')
    );

    backendLogger.debug('[WebSocket] Plan membership check', {
      userId,
      planId,
      isMember,
      permissionCount: plan.permissions?.length || 0
    });

    return isMember;
  } catch (error) {
    backendLogger.error('[WebSocket] Error checking plan membership', {
      userId,
      planId,
      error: error.message
    }, error);
    return false;
  }
}

/**
 * Initialize WebSocket server attached to HTTP server
 *
 * @param {http.Server} server - HTTP server instance
 * @param {object} options - Configuration options
 * @returns {WebSocket.Server} WebSocket server instance
 */
function createWebSocketServer(server, options = {}) {
  const wss = new WebSocket.Server({
    server,
    path: options.path || '/ws',
    verifyClient: (info, callback) => {
      // Parse query string for token
      const query = url.parse(info.req.url, true).query;
      const token = query.token;

      if (!token) {
        backendLogger.warn('[WebSocket] Connection rejected: No token provided');
        callback(false, 401, 'Unauthorized: No token provided');
        return;
      }

      try {
        // Verify JWT token
        const secret = process.env.SECRET || process.env.JWT_SECRET;
        const decoded = jwt.verify(token, secret);

        // Attach user info to request for use in connection handler
        info.req.user = decoded.user || decoded;
        callback(true);
      } catch (error) {
        backendLogger.warn('[WebSocket] Connection rejected: Invalid token', {
          error: error.message
        });
        callback(false, 401, 'Unauthorized: Invalid token');
      }
    }
  });

  // Handle new connections
  wss.on('connection', (ws, req) => {
    const user = req.user;
    const query = url.parse(req.url, true).query;
    const sessionId = query.sessionId;
    const userId = user._id || user.id;

    // Check connection limit per user
    if (!trackUserConnection(userId, ws)) {
      backendLogger.warn('[WebSocket] Connection rejected: Too many connections', { userId });
      send(ws, {
        type: 'error',
        payload: {
          message: 'Too many connections. Close some tabs or devices and try again.',
          code: 'CONNECTION_LIMIT_EXCEEDED'
        }
      });
      ws.close(4003, 'Connection limit exceeded');
      return;
    }

    backendLogger.info('[WebSocket] New connection', {
      userId,
      sessionId,
      userConnectionCount: userConnections.get(userId)?.size || 1
    });

    // Track client
    clients.set(ws, {
      userId,
      sessionId,
      rooms: new Set(),
      isAlive: true,
      connectedAt: Date.now(),
      // Rate limiting fields
      rateLimitWindow: Date.now(),
      messageCount: 0
    });

    // Set up heartbeat
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
      const client = clients.get(ws);
      if (client) {
        client.isAlive = true;
      }
    });

    // Handle incoming messages
    ws.on('message', (data) => {
      handleMessage(ws, data);
    });

    // Handle disconnection
    ws.on('close', () => {
      handleDisconnect(ws);
    });

    // Handle errors
    ws.on('error', (error) => {
      backendLogger.error('[WebSocket] Connection error', {
        userId,
        error: error.message
      }, error);
    });

    // Send welcome message with connection info
    send(ws, {
      type: 'system:connected',
      payload: {
        userId,
        sessionId,
        timestamp: Date.now()
      }
    });
  });

  // Heartbeat interval to detect dead connections
  const heartbeatTimer = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        backendLogger.debug('[WebSocket] Terminating inactive connection');
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL);

  wss.on('close', () => {
    clearInterval(heartbeatTimer);
    backendLogger.info('[WebSocket] Server closed');
  });

  backendLogger.info('[WebSocket] Server initialized', {
    path: options.path || '/ws'
  });

  return wss;
}

/**
 * Handle incoming WebSocket message
 *
 * @param {WebSocket} ws - WebSocket connection
 * @param {Buffer|string} data - Raw message data
 */
function handleMessage(ws, data) {
  const client = clients.get(ws);
  if (!client) {
    backendLogger.warn('[WebSocket] Message from unknown client');
    return;
  }

  // Check message size limit
  const messageSize = Buffer.byteLength(data);
  if (messageSize > MAX_MESSAGE_SIZE) {
    backendLogger.warn('[WebSocket] Message too large', {
      userId: client.userId,
      size: messageSize,
      maxSize: MAX_MESSAGE_SIZE
    });
    send(ws, {
      type: 'error',
      payload: {
        message: `Message too large. Maximum size is ${MAX_MESSAGE_SIZE} bytes.`,
        code: 'MESSAGE_TOO_LARGE'
      }
    });
    return;
  }

  // Check rate limit
  if (!checkRateLimit(client)) {
    send(ws, {
      type: 'error',
      payload: {
        message: 'Rate limit exceeded. Please slow down.',
        code: 'RATE_LIMIT_EXCEEDED'
      }
    });
    return;
  }

  try {
    const message = JSON.parse(data.toString());
    const { type, payload } = message;

    // Skip messages with missing or empty payload (except ping which doesn't need one)
    if (type !== 'ping' && (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0)) {
      backendLogger.warn('[WebSocket] Message with invalid/empty payload ignored', {
        type,
        userId: client.userId,
        hasPayload: !!payload,
        payloadType: typeof payload
      });
      return;
    }

    // Log incoming messages for debugging
    if (type === 'room:join' || type === 'room:leave' || type === 'presence:update' || type === 'event:broadcast') {
      backendLogger.info('[WebSocket] Incoming message', {
        type,
        payloadKeys: Object.keys(payload),
        userId: client.userId
      });
    }

    // Skip rate limiting for ping/pong (heartbeat)
    if (type === 'ping') {
      send(ws, { type: 'pong', timestamp: Date.now() });
      return;
    }

    backendLogger.info('[WebSocket] Processing message', {
      type,
      userId: client.userId,
      sessionId: client.sessionId
    });

    switch (type) {
      case 'room:join':
        handleJoinRoom(ws, client, payload).catch(error => {
          backendLogger.error('[WebSocket] Error in handleJoinRoom', { 
            error: error.message,
            userId: client.userId 
          }, error);
        });
        break;

      case 'room:leave':
        try {
          handleLeaveRoom(ws, client, payload);
        } catch (error) {
          backendLogger.error('[WebSocket] Error in handleLeaveRoom', { 
            error: error.message,
            userId: client.userId 
          }, error);
        }
        break;

      case 'event:broadcast':
        try {
          handleEventBroadcast(ws, client, payload);
        } catch (error) {
          backendLogger.error('[WebSocket] Error in handleEventBroadcast', { 
            error: error.message,
            userId: client.userId 
          }, error);
        }
        break;

      case 'presence:update':
        try {
          handlePresenceUpdate(ws, client, payload);
        } catch (error) {
          backendLogger.error('[WebSocket] Error in handlePresenceUpdate', { 
            error: error.message,
            userId: client.userId 
          }, error);
        }
        break;

      default:
        // Forward unknown types as events (for flexibility)
        if (type && payload) {
          handleEventBroadcast(ws, client, { ...payload, type });
        }
    }
  } catch (error) {
    backendLogger.error('[WebSocket] Failed to parse message', {
      error: error.message,
      userId: client.userId
    }, error);

    send(ws, {
      type: 'error',
      payload: {
        message: 'Invalid message format',
        code: 'INVALID_MESSAGE'
      }
    });
  }
}

/**
 * Handle client joining a room (experience or plan)
 * Validates that user is owner or collaborator before allowing join.
 *
 * Room Types:
 * - experience:{experienceId} - Experience collaborators
 * - plan:{planId} - Plan collaborators
 * - Legacy: planId directly (backwards compatible)
 *
 * @param {WebSocket} ws - WebSocket connection
 * @param {object} client - Client info
 * @param {object} payload - Join payload with roomId, experienceId, planId, type, tab
 */
async function handleJoinRoom(ws, client, payload) {
  // Safety check: ensure payload exists
  if (!payload || typeof payload !== 'object') {
    backendLogger.warn('[WebSocket] Invalid payload in room:join', {
      userId: client.userId,
      payload: payload
    });
    send(ws, {
      type: 'error',
      payload: { message: 'Invalid room join payload', code: 'INVALID_PAYLOAD' }
    });
    return;
  }

  const { roomId, experienceId, planId, type, roomType: roomTypeParam, tab } = payload;

  // Determine room type and ID (use roomType from payload or fall back to type)
  let roomType = roomTypeParam || type;
  let resourceId = null;
  let actualRoomId = roomId;

  // Parse roomId format: "experience:{id}" or "plan:{id}"
  if (roomId) {
    if (roomId.startsWith('experience:')) {
      roomType = 'experience';
      resourceId = roomId.replace('experience:', '');
    } else if (roomId.startsWith('plan:')) {
      roomType = 'plan';
      resourceId = roomId.replace('plan:', '');
    } else {
      // Legacy: roomId is the planId directly
      roomType = 'plan';
      resourceId = roomId;
      actualRoomId = `plan:${roomId}`;
    }
  } else if (experienceId) {
    roomType = 'experience';
    resourceId = experienceId;
    actualRoomId = `experience:${experienceId}`;
  } else if (planId) {
    roomType = 'plan';
    resourceId = planId;
    actualRoomId = `plan:${planId}`;
  }

  if (!resourceId) {
    send(ws, {
      type: 'error',
      payload: { message: 'roomId, experienceId, or planId required', code: 'MISSING_ROOM_ID' }
    });
    return;
  }

  // Validate membership based on room type
  let isMember = false;
  if (roomType === 'experience') {
    isMember = await isExperienceMember(client.userId, resourceId);
  } else if (roomType === 'plan') {
    isMember = await isPlanMember(client.userId, resourceId);
  }

  if (!isMember) {
    backendLogger.warn('[WebSocket] Room join denied - not a member', {
      userId: client.userId,
      roomType,
      resourceId,
      actualRoomId
    });
    send(ws, {
      type: 'error',
      payload: {
        message: 'Access denied. You must be an owner or collaborator to join this room.',
        code: 'ACCESS_DENIED'
      }
    });
    return;
  }

  // Create room if doesn't exist
  if (!rooms.has(actualRoomId)) {
    rooms.set(actualRoomId, new Set());
  }

  const room = rooms.get(actualRoomId);
  room.add(ws);
  client.rooms.add(actualRoomId);

  // Store additional client info for presence
  client.currentTab = tab;
  client.roomType = roomType;

  // Check if user has private profile - cache this for presence filtering
  const isPrivate = await hasPrivateProfile(client.userId);
  client.hasPrivateProfile = isPrivate;

  backendLogger.info('[WebSocket] Client joined room', {
    userId: client.userId,
    roomId: actualRoomId,
    roomType,
    tab,
    roomSize: room.size,
    hasPrivateProfile: isPrivate
  });

  // Only broadcast presence:joined if user doesn't have a private profile
  // Private profile users should appear as offline to others
  if (!isPrivate) {
    const presenceMessage = {
      type: 'presence:joined',
      payload: {
        userId: client.userId,
        sessionId: client.sessionId,
        roomId: actualRoomId,
        experienceId: roomType === 'experience' ? resourceId : undefined,
        planId: roomType === 'plan' ? resourceId : undefined,
        tab,
        timestamp: Date.now()
      }
    };
    
    backendLogger.info('[WebSocket] Broadcasting presence:joined', {
      roomId: actualRoomId,
      userId: client.userId,
      roomSize: room.size,
      excludingSelf: true
    });
    
    broadcastToRoom(actualRoomId, presenceMessage, ws);
  }

  // Send room info to the joining client (including all members they can see)
  const members = await getActiveRoomMembers(actualRoomId);
  send(ws, {
    type: 'room:joined',
    payload: {
      roomId: actualRoomId,
      experienceId: roomType === 'experience' ? resourceId : undefined,
      planId: roomType === 'plan' ? resourceId : undefined,
      members
    }
  });
}

/**
 * Handle client leaving a room
 *
 * @param {WebSocket} ws - WebSocket connection
 * @param {object} client - Client info
 * @param {object} payload - Leave payload with roomId, experienceId, or planId
 */
function handleLeaveRoom(ws, client, payload) {
  // Safety check: ensure payload exists
  if (!payload || typeof payload !== 'object') {
    backendLogger.warn('[WebSocket] Invalid payload in room:leave', {
      userId: client.userId,
      payload: payload
    });
    return;
  }

  const { roomId, experienceId, planId } = payload;

  // Determine the actual room ID
  let actualRoomId = roomId;
  if (!actualRoomId && experienceId) {
    actualRoomId = `experience:${experienceId}`;
  } else if (!actualRoomId && planId) {
    actualRoomId = `plan:${planId}`;
  }

  if (!actualRoomId) return;

  leaveRoom(ws, client, actualRoomId);
}

/**
 * Remove client from a room
 *
 * @param {WebSocket} ws - WebSocket connection
 * @param {object} client - Client info
 * @param {string} roomId - Room ID (format: "experience:{id}" or "plan:{id}")
 */
function leaveRoom(ws, client, roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.delete(ws);
  client.rooms.delete(roomId);

  // Parse room type for payload
  let experienceId, planId;
  if (roomId.startsWith('experience:')) {
    experienceId = roomId.replace('experience:', '');
  } else if (roomId.startsWith('plan:')) {
    planId = roomId.replace('plan:', '');
  }

  backendLogger.info('[WebSocket] Client left room', {
    userId: client.userId,
    roomId,
    roomSize: room.size,
    hasPrivateProfile: client.hasPrivateProfile
  });

  // Clean up empty rooms
  if (room.size === 0) {
    rooms.delete(roomId);
  }

  // Only broadcast presence:left if user doesn't have a private profile
  // Private profile users were never announced as online, so no need to announce leaving
  if (!client.hasPrivateProfile) {
    broadcastToRoom(roomId, {
      type: 'presence:left',
      payload: {
        userId: client.userId,
        sessionId: client.sessionId,
        roomId,
        experienceId,
        planId,
        timestamp: Date.now()
      }
    }, ws);
  }
}

/**
 * Handle event broadcast to room members
 *
 * @param {WebSocket} ws - WebSocket connection (sender)
 * @param {object} client - Client info
 * @param {object} payload - Event payload including roomId, experienceId, or planId
 */
function handleEventBroadcast(ws, client, payload) {
  // Safety check: ensure payload exists
  if (!payload || typeof payload !== 'object') {
    backendLogger.warn('[WebSocket] Invalid payload in event:broadcast', {
      userId: client.userId,
      payload: payload
    });
    return;
  }

  const { roomId, experienceId, planId, ...eventData } = payload;

  // Determine the target room
  let targetRoomId = roomId;
  if (!targetRoomId && experienceId) {
    targetRoomId = `experience:${experienceId}`;
  } else if (!targetRoomId && planId) {
    targetRoomId = `plan:${planId}`;
  }

  if (!targetRoomId) {
    // If no room specified, broadcast to all rooms the client is in
    client.rooms.forEach((rid) => {
      broadcastToRoom(rid, {
        type: 'event:received',
        payload: {
          ...eventData,
          roomId: rid,
          userId: client.userId,
          sessionId: client.sessionId,
          timestamp: Date.now()
        }
      }, ws);
    });
    return;
  }

  // Verify client is in the room
  if (!client.rooms.has(targetRoomId)) {
    send(ws, {
      type: 'error',
      payload: { message: 'Not a member of this room', code: 'NOT_IN_ROOM' }
    });
    return;
  }

  // Broadcast to room members
  broadcastToRoom(targetRoomId, {
    type: 'event:received',
    payload: {
      ...eventData,
      roomId: targetRoomId,
      experienceId,
      planId,
      userId: client.userId,
      sessionId: client.sessionId,
      timestamp: Date.now()
    }
  }, ws);
}

/**
 * Handle presence update (cursor position, typing indicator, tab change, etc.)
 *
 * @param {WebSocket} ws - WebSocket connection
 * @param {object} client - Client info
 * @param {object} payload - Presence data including roomId, experienceId, or planId
 */
function handlePresenceUpdate(ws, client, payload) {
  // Safety check: ensure payload exists
  if (!payload || typeof payload !== 'object') {
    backendLogger.warn('[WebSocket] Invalid payload in presence:update', {
      userId: client.userId,
      payload: payload
    });
    return;
  }

  const { roomId, experienceId, planId, ...presenceData } = payload;

  // Determine the target room
  let targetRoomId = roomId;
  if (!targetRoomId && experienceId) {
    targetRoomId = `experience:${experienceId}`;
  } else if (!targetRoomId && planId) {
    targetRoomId = `plan:${planId}`;
  }

  if (!targetRoomId || !client.rooms.has(targetRoomId)) return;

  // Update client's current tab if this is a tab change
  if (presenceData.type === 'tab_change' && presenceData.tab) {
    client.currentTab = presenceData.tab;
  }

  // Don't broadcast presence updates for users with private profiles
  // They should always appear as offline to others
  if (client.hasPrivateProfile) {
    return;
  }

  broadcastToRoom(targetRoomId, {
    type: 'presence:updated',
    payload: {
      userId: client.userId,
      sessionId: client.sessionId,
      roomId: targetRoomId,
      experienceId,
      planId,
      ...presenceData,
      timestamp: Date.now()
    }
  }, ws);
}

/**
 * Handle client disconnection
 *
 * @param {WebSocket} ws - WebSocket connection
 */
function handleDisconnect(ws) {
  const client = clients.get(ws);
  if (!client) return;

  backendLogger.info('[WebSocket] Client disconnected', {
    userId: client.userId,
    sessionId: client.sessionId,
    roomCount: client.rooms.size
  });

  // Leave all rooms
  client.rooms.forEach((planId) => {
    leaveRoom(ws, client, planId);
  });

  // Remove from user connection tracking
  removeUserConnection(client.userId, ws);

  // Remove from clients map
  clients.delete(ws);
}

/**
 * Broadcast message to all members of a room
 *
 * @param {string} planId - Room/plan ID
 * @param {object} message - Message to send
 * @param {WebSocket} [excludeWs] - Optional WebSocket to exclude (sender)
 */
function broadcastToRoom(planId, message, excludeWs = null) {
  const room = rooms.get(planId);
  if (!room) {
    backendLogger.debug('[WebSocket] Room not found for broadcast', { roomId: planId });
    return;
  }

  let sentCount = 0;
  room.forEach((ws) => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      send(ws, message);
      sentCount++;
    }
  });
  
  backendLogger.debug('[WebSocket] Broadcast sent to room', {
    roomId: planId,
    messageType: message.type,
    recipientCount: sentCount,
    totalRoomSize: room.size
  });
}

/**
 * Send message to a specific WebSocket
 *
 * @param {WebSocket} ws - WebSocket connection
 * @param {object} message - Message to send
 */
function send(ws, message) {
  if (ws.readyState !== WebSocket.OPEN) return;

  try {
    ws.send(JSON.stringify(message));
  } catch (error) {
    backendLogger.error('[WebSocket] Failed to send message', {
      error: error.message
    }, error);
  }
}

/**
 * Get list of active members in a room
 * Filters out users with private profile visibility
 *
 * @param {string} roomId - Room ID (format: "experience:{id}" or "plan:{id}")
 * @returns {Promise<Array<object>>} Array of member info including tab for experience rooms
 */
async function getActiveRoomMembers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];

  const members = [];
  for (const ws of room) {
    const client = clients.get(ws);
    if (client && ws.readyState === WebSocket.OPEN) {
      // Skip users with private profiles - they should appear as offline
      if (client.hasPrivateProfile) {
        continue;
      }
      members.push({
        userId: client.userId,
        sessionId: client.sessionId,
        tab: client.currentTab,
        connectedAt: client.connectedAt
      });
    }
  }

  return members;
}

/**
 * Get server statistics
 *
 * @returns {object} Server statistics
 */
function getStats() {
  return {
    totalConnections: clients.size,
    totalRooms: rooms.size,
    uniqueUsers: userConnections.size,
    roomSizes: Array.from(rooms.entries()).map(([roomId, room]) => ({
      roomId,
      memberCount: room.size
    })),
    // Rate limit config (for monitoring)
    config: {
      rateLimitMax: RATE_LIMIT_MAX,
      rateLimitWindowMs: RATE_LIMIT_WINDOW_MS,
      maxMessageSize: MAX_MESSAGE_SIZE,
      maxConnectionsPerUser: MAX_CONNECTIONS_PER_USER
    }
  };
}

/**
 * Broadcast an event to a room from a controller
 * This is the primary method for controllers to push real-time updates
 *
 * @param {string} roomType - 'experience' or 'plan'
 * @param {string} resourceId - The experience or plan ID
 * @param {object} event - The event to broadcast
 * @param {string} event.type - Event type (e.g., 'experience:updated', 'plan:item:added')
 * @param {object} event.payload - Event payload data
 * @param {string} [excludeUserId] - Optional user ID to exclude from broadcast (usually the sender)
 */
function broadcastEvent(roomType, resourceId, event, excludeUserId = null) {
  if (!roomType || !resourceId || !event) {
    backendLogger.warn('[WebSocket] broadcastEvent called with invalid params', {
      roomType,
      resourceId,
      hasEvent: !!event
    });
    return;
  }

  const roomId = `${roomType}:${resourceId}`;
  const room = rooms.get(roomId);

  if (!room || room.size === 0) {
    backendLogger.debug('[WebSocket] No clients in room, skipping broadcast', { roomId });
    return;
  }

  const message = {
    type: event.type || 'event:received',
    payload: {
      ...event.payload,
      roomId,
      timestamp: Date.now(),
      version: event.version || Date.now()
    }
  };

  let sentCount = 0;
  room.forEach((ws) => {
    // Skip if we should exclude this user
    if (excludeUserId) {
      const client = clients.get(ws);
      if (client && client.userId === excludeUserId.toString()) {
        return;
      }
    }

    if (ws.readyState === WebSocket.OPEN) {
      send(ws, message);
      sentCount++;
    }
  });

  backendLogger.debug('[WebSocket] Broadcast event sent', {
    roomId,
    eventType: event.type,
    sentCount,
    totalInRoom: room.size
  });
}

/**
 * Send an event directly to a specific user's active WebSocket connections.
 *
 * This is useful when a user should be notified immediately (e.g. added as a
 * collaborator) but they may not yet be a member of an experience/plan room.
 *
 * @param {string} userId - Target user ID
 * @param {object} event - Event to send
 * @param {string} event.type - Event type
 * @param {object} event.payload - Event payload
 */
function sendEventToUser(userId, event) {
  if (!userId || !event) {
    backendLogger.warn('[WebSocket] sendEventToUser called with invalid params', {
      hasUserId: !!userId,
      hasEvent: !!event
    });
    return;
  }

  const userIdStr = userId.toString();
  const connections = userConnections.get(userIdStr);

  if (!connections || connections.size === 0) {
    backendLogger.debug('[WebSocket] No active connections for user, skipping direct send', {
      userId: userIdStr,
      eventType: event.type
    });
    return;
  }

  const message = {
    type: event.type || 'event:received',
    payload: {
      ...event.payload,
      timestamp: Date.now(),
      version: event.version || Date.now()
    }
  };

  let sentCount = 0;
  connections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      send(ws, message);
      sentCount++;
    }
  });

  backendLogger.debug('[WebSocket] Direct user event sent', {
    userId: userIdStr,
    eventType: event.type,
    sentCount,
    totalConnections: connections.size
  });
}

// =====================
// Periodic Cleanup
// =====================

/**
 * Cleanup interval in milliseconds (1 minute)
 */
const CLEANUP_INTERVAL_MS = 60 * 1000;

/**
 * Cleanup stale entries from caches and connection tracking
 * Runs periodically to prevent memory leaks
 */
function performCleanup() {
  const now = Date.now();
  let cleanedVisibility = 0;
  let cleanedConnections = 0;

  // 1. Clean stale visibility cache entries (older than 2x TTL)
  for (const [userId, entry] of userVisibilityCache) {
    if (now - entry.cachedAt > VISIBILITY_CACHE_TTL * 2) {
      userVisibilityCache.delete(userId);
      cleanedVisibility++;
    }
  }

  // 2. Clean stale user connections (WebSockets that are no longer open)
  for (const [userId, connections] of userConnections) {
    for (const ws of connections) {
      if (ws.readyState !== 1) { // WebSocket.OPEN = 1
        connections.delete(ws);
        cleanedConnections++;
      }
    }
    // Remove user entry if no connections left
    if (connections.size === 0) {
      userConnections.delete(userId);
    }
  }

  // 3. Clean stale clients from client tracking
  for (const [ws, client] of clients) {
    if (ws.readyState !== 1) {
      clients.delete(ws);
    }
  }

  // 4. Clean empty rooms
  for (const [roomId, room] of rooms) {
    if (room.size === 0) {
      rooms.delete(roomId);
    }
  }

  if (cleanedVisibility > 0 || cleanedConnections > 0) {
    backendLogger.debug('[WebSocket] Cleanup completed', {
      cleanedVisibilityCacheEntries: cleanedVisibility,
      cleanedStaleConnections: cleanedConnections,
      currentVisibilityCacheSize: userVisibilityCache.size,
      currentUserConnections: userConnections.size,
      currentClients: clients.size,
      currentRooms: rooms.size
    });
  }
}

// Start periodic cleanup
const cleanupInterval = setInterval(performCleanup, CLEANUP_INTERVAL_MS);

// Ensure cleanup interval doesn't prevent process exit
cleanupInterval.unref();

module.exports = {
  createWebSocketServer,
  getStats,
  broadcastEvent,
  sendEventToUser,
  broadcastToRoom,
  // Cache invalidation for when user updates profile visibility
  invalidateVisibilityCache,
  // Expose for testing
  rooms,
  clients
};
