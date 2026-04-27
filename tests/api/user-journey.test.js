/**
 * Authenticated end-to-end user journey (bd #8f36.23)
 *
 * Walks a single user through the full lifecycle at the HTTP/auth/Mongo layer:
 *
 *   1. Sign up + verify email (token captured via stubbed sendEmailConfirmation)
 *   2. Log in
 *   3. Create a destination
 *   4. Create an experience at that destination
 *   5. Plan the experience
 *   6. Invite a collaborator (second test user) and verify access
 *   7. Open BienBot, exchange one message + execute one pending action
 *   8. Sign out (POST /api/auth/logout)
 *
 * The frontend is intentionally skipped — this is "E2E at the API layer"
 * exercising the complete supertest + auth + mongoose stack with mocked AI
 * and email side effects, mirroring tests/api/bienbot.test.js conventions.
 */

// ---- Capture outbound email confirmations (so we can extract the raw token)
const capturedEmails = [];
jest.mock('../../utilities/email-service', () => ({
  sendEmailConfirmation: jest.fn(async (toEmail, userName, confirmUrl) => {
    capturedEmails.push({ toEmail, userName, confirmUrl });
  }),
  sendPasswordResetEmail: jest.fn(),
  sendPasswordResetConfirmation: jest.fn(),
  sendInviteEmail: jest.fn(),
  sendCollaboratorInviteEmail: jest.fn(),
  sendPlanAccessRequestEmail: jest.fn()
}));

// ---- Mock SMS / phone verification (loaded by users controller)
jest.mock('../../utilities/sinch', () => ({
  startSmsVerification: jest.fn(),
  reportSmsVerificationById: jest.fn()
}));

// ---- Mock AI layer (deterministic LLM response with one pending_action) ----
// Covers all handlers referenced by routes/api/ai.js. editLanguage included
// per the pattern from commit da5371d (route loading fails without it).
jest.mock('../../controllers/api/ai', () => ({
  callProvider: jest.fn().mockResolvedValue({
    content: JSON.stringify({
      message: 'I can help with that. I have one suggestion ready for you to confirm.',
      pending_actions: []
    }),
    usage: { prompt_tokens: 25, completion_tokens: 25 }
  }),
  getApiKey: jest.fn().mockReturnValue('test-api-key'),
  getProviderForTask: jest.fn().mockReturnValue('openai'),
  AI_PROVIDERS: { OPENAI: 'openai' },
  AI_TASKS: { GENERAL: 'general', FAST: 'fast', BIENBOT_ANALYZE: 'bienbot_analyze' },
  status: jest.fn((req, res) => res.json({ success: true, available: true })),
  complete: jest.fn((req, res) => res.json({ success: true })),
  autocomplete: jest.fn((req, res) => res.json({ success: true })),
  improve: jest.fn((req, res) => res.json({ success: true })),
  editLanguage: jest.fn((req, res) => res.json({ success: true })),
  translate: jest.fn((req, res) => res.json({ success: true })),
  summarize: jest.fn((req, res) => res.json({ success: true })),
  generateTips: jest.fn((req, res) => res.json({ success: true }))
}));

// ---- Mock intent classifier (NLP.js boot is heavy; not needed here) -------
jest.mock('../../utilities/bienbot-intent-classifier', () => ({
  classifyIntent: jest.fn().mockResolvedValue({
    intent: 'ANSWER_QUESTION',
    entities: { destination_name: null, experience_name: null, user_email: null, plan_item_texts: [] },
    confidence: 0.9
  })
}));

// ---- Mock context builders (auto-stub to keep new builders working) -------
jest.mock('../../utilities/bienbot-context-builders', () => {
  const actual = jest.requireActual('../../utilities/bienbot-context-builders');
  const mocked = {};
  for (const [key, value] of Object.entries(actual)) {
    mocked[key] = typeof value === 'function' ? jest.fn().mockResolvedValue(null) : value;
  }
  mocked.buildContextForInvokeContext = jest.fn().mockResolvedValue(null);
  return mocked;
});

// ---- Mock session summarizer ----------------------------------------------
jest.mock('../../utilities/bienbot-session-summarizer', () => ({
  summarizeSession: jest.fn().mockResolvedValue({ summary: '', next_steps: [] })
}));

// ---- Mock document parsing + upload pipeline (no S3 / OCR in tests) -------
jest.mock('../../utilities/ai-document-utils', () => ({
  validateDocument: jest.fn().mockReturnValue({ valid: true, type: 'image' }),
  extractText: jest.fn().mockResolvedValue({ text: '', metadata: {} })
}));
jest.mock('../../utilities/upload-pipeline', () => ({
  uploadWithPipeline: jest.fn().mockResolvedValue({ s3Status: 'uploaded', s3Result: {} }),
  retrieveFile: jest.fn().mockResolvedValue({ source: 's3', signedUrl: 'https://example.com/x' }),
  deleteFile: jest.fn().mockResolvedValue(),
  deleteFileSafe: jest.fn().mockResolvedValue({ deleted: true }),
  transferBucket: jest.fn().mockResolvedValue({}),
  downloadToLocal: jest.fn().mockResolvedValue({ localPath: '/tmp/x', contentType: 'image/png', size: 1 }),
  resolveAndValidateLocalUploadPath: jest.fn().mockReturnValue('/tmp/validated'),
  S3_STATUS: { PENDING: 'pending', UPLOADED: 'uploaded', FAILED: 'failed' }
}));

// NOTE: bienbot-action-executor is intentionally NOT mocked. Step 7 needs the
// real executor to actually create the destination so we can assert the side
// effect on the database.

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const User = require('../../models/user');
const Destination = require('../../models/destination');
const Experience = require('../../models/experience');
const Plan = require('../../models/plan');
const BienBotSession = require('../../models/bienbot-session');
const dbSetup = require('../setup/testSetup');

/**
 * Parse SSE stream body into individual events (mirrors bienbot.test.js helper).
 */
function parseSSEEvents(text) {
  const events = [];
  const blocks = text.split(/\n\n/).filter(Boolean);
  for (const block of blocks) {
    const lines = block.split('\n');
    let event = 'message';
    let data = null;
    for (const line of lines) {
      if (line.startsWith('event: ')) event = line.slice(7).trim();
      if (line.startsWith('data: ')) {
        try { data = JSON.parse(line.slice(6)); } catch { data = line.slice(6); }
      }
    }
    if (data !== null) events.push({ event, data });
  }
  return events;
}

describe('Authenticated user journey', () => {
  beforeAll(async () => {
    await dbSetup.connect();
  });

  afterAll(async () => {
    await dbSetup.closeDatabase();
  });

  beforeEach(async () => {
    capturedEmails.length = 0;
    await User.deleteMany({});
    await Destination.deleteMany({});
    await Experience.deleteMany({});
    await Plan.deleteMany({});
    await BienBotSession.deleteMany({});
  });

  it('walks signup -> login -> destination -> experience -> plan -> collaborator -> bienbot -> sign out', async () => {
    // -------------------------------------------------------------------
    // Step 1: Sign up + verify email
    // -------------------------------------------------------------------
    const signupPayload = {
      name: 'Journey User',
      email: 'journey.user@example.com',
      password: 'JourneyPass1!'
    };

    const signupRes = await request(app)
      .post('/api/users')
      .send(signupPayload);

    expect(signupRes.status).toBe(201);
    // Signup returns the JWT token directly as response.body.data
    const signupToken = signupRes.body.data;
    expect(typeof signupToken).toBe('string');
    expect(signupToken.split('.')).toHaveLength(3); // JWT format

    // The mocked email service captured the confirmation URL
    expect(capturedEmails).toHaveLength(1);
    expect(capturedEmails[0].toEmail).toBe(signupPayload.email);
    const confirmUrl = capturedEmails[0].confirmUrl;
    const rawConfirmToken = confirmUrl.split('/').pop();
    expect(rawConfirmToken).toMatch(/^[a-f0-9]{64}$/);

    const confirmRes = await request(app)
      .get(`/api/users/confirm-email/${rawConfirmToken}`);

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.success).toBe(true);

    const verifiedUser = await User.findOne({ email: signupPayload.email });
    expect(verifiedUser.emailConfirmed).toBe(true);

    // -------------------------------------------------------------------
    // Step 2: Log in
    // -------------------------------------------------------------------
    const loginRes = await request(app)
      .post('/api/users/login')
      .send({ email: signupPayload.email, password: signupPayload.password });

    expect(loginRes.status).toBe(200);
    const loginData = loginRes.body.data;
    expect(loginData.token).toBeTruthy();
    expect(loginData.user.email).toBe(signupPayload.email);
    const authToken = loginData.token;

    // -------------------------------------------------------------------
    // Step 3: Create a destination
    // -------------------------------------------------------------------
    const destPayload = {
      name: 'Lisbon',
      country: 'Portugal',
      state: 'Lisbon District',
      travel_tips: ['Try pasteis de nata', 'Ride Tram 28']
    };
    const destRes = await request(app)
      .post('/api/destinations')
      .set('Authorization', `Bearer ${authToken}`)
      .send(destPayload);

    expect(destRes.status).toBe(201);
    const destination = destRes.body.data;
    expect(destination.name).toBe(destPayload.name);
    expect(destination.country).toBe(destPayload.country);
    expect(destination._id).toBeTruthy();

    // -------------------------------------------------------------------
    // Step 4: Create an experience at that destination
    // -------------------------------------------------------------------
    const expPayload = {
      name: 'Lisbon Food Tour',
      overview: 'A full-day walking tour of historic Lisbon eateries.',
      destination: destination._id,
      experience_type: ['food', 'walking']
    };
    const expRes = await request(app)
      .post('/api/experiences')
      .set('Authorization', `Bearer ${authToken}`)
      .send(expPayload);

    expect(expRes.status).toBe(201);
    const experience = expRes.body.data;
    expect(experience.name).toBe(expPayload.name);
    expect(experience.destination.toString()).toBe(destination._id.toString());

    // -------------------------------------------------------------------
    // Step 5: Plan the experience
    // -------------------------------------------------------------------
    const planRes = await request(app)
      .post(`/api/plans/experience/${experience._id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ planned_date: new Date('2026-08-15').toISOString(), currency: 'EUR' });

    expect(planRes.status).toBe(201);
    const plan = planRes.body.data;
    expect(plan._id).toBeTruthy();
    expect(plan.currency).toBe('EUR');
    expect(plan.experience._id.toString()).toBe(experience._id.toString());

    // -------------------------------------------------------------------
    // Step 6: Invite a collaborator (create second user, add to plan)
    // -------------------------------------------------------------------
    const collabPayload = {
      name: 'Collaborator User',
      email: 'collab.user@example.com',
      password: 'CollabPass1!'
    };
    const collabSignupRes = await request(app)
      .post('/api/users')
      .send(collabPayload);

    expect(collabSignupRes.status).toBe(201);
    const collabUser = await User.findOne({ email: collabPayload.email });
    // Confirm collaborator's email so they can perform write actions if needed
    collabUser.emailConfirmed = true;
    await collabUser.save();
    expect(collabUser._id).toBeTruthy();

    const addCollabRes = await request(app)
      .post(`/api/plans/${plan._id}/permissions/collaborator`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ userId: collabUser._id.toString() });

    expect(addCollabRes.status).toBe(200);

    // Verify the second user can now access the plan
    const collabLoginRes = await request(app)
      .post('/api/users/login')
      .send({ email: collabPayload.email, password: collabPayload.password });
    expect(collabLoginRes.status).toBe(200);
    const collabToken = collabLoginRes.body.data.token;

    const collabPlanRes = await request(app)
      .get(`/api/plans/${plan._id}`)
      .set('Authorization', `Bearer ${collabToken}`);
    expect(collabPlanRes.status).toBe(200);
    // getPlanById returns the plan as the raw response body (res.json(plan)).
    const accessiblePlan = collabPlanRes.body;
    expect(accessiblePlan._id.toString()).toBe(plan._id.toString());
    // Verify the second user appears in plan permissions as a collaborator.
    const planAfterInvite = await Plan.findById(plan._id);
    const collabPerm = planAfterInvite.permissions.find(
      p => p.entity === 'user' && p._id.toString() === collabUser._id.toString()
    );
    expect(collabPerm).toBeTruthy();
    expect(collabPerm.type).toBe('collaborator');

    // -------------------------------------------------------------------
    // Step 7: BienBot — exchange one message and execute one pending action
    // -------------------------------------------------------------------
    // BienBot endpoints require the ai_features feature flag.
    await User.findByIdAndUpdate(verifiedUser._id, {
      feature_flags: [
        {
          flag: 'ai_features',
          enabled: true,
          granted_at: new Date(),
          granted_by: null
        }
      ]
    });

    // Script the LLM to return a single pending_action proposing the creation
    // of a NEW destination — that lets us assert a real DB side-effect when
    // the action is executed.
    const { callProvider } = require('../../controllers/api/ai');
    const proposedAction = {
      id: 'action_journey1',
      type: 'create_destination',
      payload: { name: 'Porto', country: 'Portugal', state: 'Porto District' },
      description: 'Create a new destination: Porto, Portugal'
    };
    callProvider.mockResolvedValueOnce({
      content: JSON.stringify({
        message: 'Sure! I can also add Porto to your trip plan.',
        pending_actions: [proposedAction]
      }),
      usage: { prompt_tokens: 30, completion_tokens: 30 }
    });

    const chatRes = await request(app)
      .post('/api/bienbot/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .buffer(true)
      .parse((response, callback) => {
        let data = '';
        response.on('data', chunk => { data += chunk.toString(); });
        response.on('end', () => callback(null, data));
      })
      .send({ message: 'I am planning a Portugal trip — what else should I add?' });

    expect(chatRes.status).toBe(200);
    expect(chatRes.headers['content-type']).toContain('text/event-stream');
    const chatEvents = parseSSEEvents(chatRes.body);
    const sessionEvent = chatEvents.find(e => e.event === 'session');
    expect(sessionEvent).toBeTruthy();
    const sessionId = sessionEvent.data.sessionId;

    // The pending_action must be persisted on the session
    const sessionAfterChat = await BienBotSession.findById(sessionId);
    expect(sessionAfterChat).toBeTruthy();
    expect(sessionAfterChat.user.toString()).toBe(verifiedUser._id.toString());
    const persistedAction = sessionAfterChat.pending_actions.find(
      a => a.id === proposedAction.id
    );
    expect(persistedAction).toBeTruthy();
    expect(persistedAction.type).toBe('create_destination');

    // Execute the pending action — this runs the real action executor and
    // creates a Destination row in Mongo.
    const execRes = await request(app)
      .post(`/api/bienbot/sessions/${sessionId}/execute`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ actionIds: [proposedAction.id] });

    expect(execRes.status).toBe(200);
    const execBody = execRes.body?.data || execRes.body;
    expect(execBody.results).toBeDefined();
    expect(Array.isArray(execBody.results)).toBe(true);
    expect(execBody.results.length).toBeGreaterThan(0);
    expect(execBody.results[0].success).toBe(true);

    // Verify the side-effect: Porto destination now exists in Mongo and the
    // signed-in user is recorded as the owner via the permissions array.
    const portoDest = await Destination.findOne({ name: 'Porto', country: 'Portugal' });
    expect(portoDest).toBeTruthy();
    const portoOwner = portoDest.permissions.find(
      p => p.entity === 'user' && p.type === 'owner'
    );
    expect(portoOwner).toBeTruthy();
    expect(portoOwner._id.toString()).toBe(verifiedUser._id.toString());

    // -------------------------------------------------------------------
    // Step 8: Sign out (POST /api/auth/logout)
    // -------------------------------------------------------------------
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${authToken}`);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.message).toMatch(/logged out/i);
  }, 60000);
});
