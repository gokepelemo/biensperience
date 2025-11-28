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
    const experience = await Experience.findById(experienceId, 'permissions').lean();

    if (!experience) {
      backendLogger.debug('[WebSocket] Experience not found', { experienceId });
      return false;
    }

    // Check if user is in permissions array with owner or collaborator role
    const isMember = experience.permissions?.some(p =>
      p.entity === 'user' &&
      p._id?.toString() === userId?.toString() &&
      (p.type === 'owner' || p.type === 'collaborator')
    );

    backendLogger.debug('[WebSocket] Experience membership check', {
      userId,
      experienceId,
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

    backendLogger.info('[WebSocket] New connection', {
      userId: user._id || user.id,
      sessionId
    });

    // Track client
    clients.set(ws, {
      userId: user._id || user.id,
      sessionId,
      rooms: new Set(),
      isAlive: true,
      connectedAt: Date.now()
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
        userId: user._id || user.id,
        error: error.message
      }, error);
    });

    // Send welcome message with connection info
    send(ws, {
      type: 'system:connected',
      payload: {
        userId: user._id || user.id,
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

  try {
    const message = JSON.parse(data.toString());
    const { type, payload } = message;

    backendLogger.debug('[WebSocket] Message received', {
      type,
      userId: client.userId,
      sessionId: client.sessionId
    });

    switch (type) {
      case 'room:join':
        handleJoinRoom(ws, client, payload);
        break;

      case 'room:leave':
        handleLeaveRoom(ws, client, payload);
        break;

      case 'event:broadcast':
        handleEventBroadcast(ws, client, payload);
        break;

      case 'presence:update':
        handlePresenceUpdate(ws, client, payload);
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
  const { roomId, experienceId, planId, type, tab } = payload;

  // Determine room type and ID
  let roomType = type;
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

  backendLogger.info('[WebSocket] Client joined room', {
    userId: client.userId,
    roomId: actualRoomId,
    roomType,
    tab,
    roomSize: room.size
  });

  // Notify others in the room about the new member
  broadcastToRoom(actualRoomId, {
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
  }, ws);

  // Send room info to the joining client
  send(ws, {
    type: 'room:joined',
    payload: {
      roomId: actualRoomId,
      experienceId: roomType === 'experience' ? resourceId : undefined,
      planId: roomType === 'plan' ? resourceId : undefined,
      members: getActiveRoomMembers(actualRoomId)
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
    roomSize: room.size
  });

  // Clean up empty rooms
  if (room.size === 0) {
    rooms.delete(roomId);
  }

  // Notify others in the room
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

/**
 * Handle event broadcast to room members
 *
 * @param {WebSocket} ws - WebSocket connection (sender)
 * @param {object} client - Client info
 * @param {object} payload - Event payload including roomId, experienceId, or planId
 */
function handleEventBroadcast(ws, client, payload) {
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
  if (!room) return;

  room.forEach((ws) => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      send(ws, message);
    }
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
 *
 * @param {string} roomId - Room ID (format: "experience:{id}" or "plan:{id}")
 * @returns {Array<object>} Array of member info including tab for experience rooms
 */
function getActiveRoomMembers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];

  const members = [];
  room.forEach((ws) => {
    const client = clients.get(ws);
    if (client && ws.readyState === WebSocket.OPEN) {
      members.push({
        userId: client.userId,
        sessionId: client.sessionId,
        tab: client.currentTab,
        connectedAt: client.connectedAt
      });
    }
  });

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
    roomSizes: Array.from(rooms.entries()).map(([planId, room]) => ({
      planId,
      memberCount: room.size
    }))
  };
}

module.exports = {
  createWebSocketServer,
  getStats,
  // Expose for testing
  rooms,
  clients
};
