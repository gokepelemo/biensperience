/**
 * Unit tests for bienbot-action-executor
 *
 * Tests:
 * - ALLOWED_ACTION_TYPES allowlist enforcement
 * - executeAction() dispatches to correct handlers
 * - executeAction() rejects unknown action types
 * - executeActions() processes multiple actions in sequence
 * - executeActions() extracts context updates from results
 * - executeActions() marks actions as executed on session
 * - Error handling when handlers throw
 */

// Mock controllers to avoid real DB calls in unit tests
jest.mock('../../controllers/api/destinations');
jest.mock('../../controllers/api/experiences');
jest.mock('../../controllers/api/plans');

const {
  executeAction,
  executeActions,
  ALLOWED_ACTION_TYPES
} = require('../../utilities/bienbot-action-executor');

const destinationsController = require('../../controllers/api/destinations');
const experiencesController = require('../../controllers/api/experiences');
const plansController = require('../../controllers/api/plans');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides = {}) {
  return {
    _id: '507f1f77bcf86cd799439011',
    name: 'Test User',
    email: 'testuser@example.com',
    ...overrides
  };
}

/**
 * Configure a controller mock to simulate a successful response.
 * The mock captures the (req, res) call and calls res.status(statusCode).json(body).
 */
function mockControllerSuccess(controllerFn, statusCode, body) {
  controllerFn.mockImplementationOnce(async (req, res) => {
    res.status(statusCode).json({ success: true, data: body });
  });
}

function mockControllerError(controllerFn, statusCode, errorMsg) {
  controllerFn.mockImplementationOnce(async (req, res) => {
    res.status(statusCode).json({ success: false, error: errorMsg });
  });
}

function makeSession(actionId) {
  return {
    markActionExecuted: jest.fn().mockResolvedValue({}),
    updateContext: jest.fn().mockResolvedValue({})
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('bienbot-action-executor', () => {
  const user = makeUser();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // ALLOWED_ACTION_TYPES
  // -------------------------------------------------------------------------

  describe('ALLOWED_ACTION_TYPES', () => {
    it('exports an array of allowed types', () => {
      expect(Array.isArray(ALLOWED_ACTION_TYPES)).toBe(true);
      expect(ALLOWED_ACTION_TYPES.length).toBeGreaterThan(0);
    });

    it('includes all expected action types', () => {
      const expected = [
        'create_destination',
        'create_experience',
        'create_plan',
        'add_plan_items',
        'update_plan_item',
        'invite_collaborator',
        'sync_plan'
      ];
      for (const type of expected) {
        expect(ALLOWED_ACTION_TYPES).toContain(type);
      }
    });
  });

  // -------------------------------------------------------------------------
  // executeAction — allowlist enforcement
  // -------------------------------------------------------------------------

  describe('executeAction() — allowlist enforcement', () => {
    it('rejects unknown action types with success=false', async () => {
      const result = await executeAction(
        { id: 'action_test', type: 'delete_database', payload: {} },
        user
      );

      expect(result.success).toBe(false);
      expect(result.errors[0]).toMatch(/unknown action type/i);
    });

    it('returns error when action object is missing type', async () => {
      const result = await executeAction({ id: 'action_notypetest', payload: {} }, user);
      expect(result.success).toBe(false);
    });

    it('returns error when action object is null', async () => {
      const result = await executeAction(null, user);
      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // executeAction — create_destination
  // -------------------------------------------------------------------------

  describe('executeAction() — create_destination', () => {
    it('calls destinations controller create and returns success result', async () => {
      const destData = { _id: 'dest-1', name: 'Kyoto, Japan', country: 'Japan' };
      mockControllerSuccess(destinationsController.create, 201, destData);

      const result = await executeAction(
        {
          id: 'action_cd12345',
          type: 'create_destination',
          payload: { name: 'Kyoto, Japan', country: 'Japan' }
        },
        user
      );

      expect(result.success).toBe(true);
      expect(destinationsController.create).toHaveBeenCalledTimes(1);
    });

    it('returns failure when controller returns 4xx', async () => {
      mockControllerError(destinationsController.create, 422, 'Name already exists');

      const result = await executeAction(
        { id: 'action_cdbad', type: 'create_destination', payload: { name: 'Dupe' } },
        user
      );

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Name already exists');
    });
  });

  // -------------------------------------------------------------------------
  // executeAction — create_experience
  // -------------------------------------------------------------------------

  describe('executeAction() — create_experience', () => {
    it('calls experiences controller create', async () => {
      const expData = { _id: 'exp-1', name: 'Cherry Blossom Tour' };
      mockControllerSuccess(experiencesController.create, 201, expData);

      const result = await executeAction(
        {
          id: 'action_ce12345',
          type: 'create_experience',
          payload: { name: 'Cherry Blossom Tour', destination_id: 'dest-1' }
        },
        user
      );

      expect(result.success).toBe(true);
      expect(experiencesController.create).toHaveBeenCalledTimes(1);

      // Verify req body was built correctly
      const req = experiencesController.create.mock.calls[0][0];
      expect(req.body.name).toBe('Cherry Blossom Tour');
    });
  });

  // -------------------------------------------------------------------------
  // executeAction — create_plan
  // -------------------------------------------------------------------------

  describe('executeAction() — create_plan', () => {
    it('calls plans controller createPlan with correct params', async () => {
      const planData = { _id: 'plan-1', experience: { _id: 'exp-1' } };
      mockControllerSuccess(plansController.createPlan, 201, planData);

      const result = await executeAction(
        {
          id: 'action_cp12345',
          type: 'create_plan',
          payload: { experience_id: 'exp-1', planned_date: '2026-04-01' }
        },
        user
      );

      expect(result.success).toBe(true);
      expect(plansController.createPlan).toHaveBeenCalledTimes(1);

      const req = plansController.createPlan.mock.calls[0][0];
      expect(req.params.experienceId).toBe('exp-1');
    });
  });

  // -------------------------------------------------------------------------
  // executeAction — error handling
  // -------------------------------------------------------------------------

  describe('executeAction() — error handling', () => {
    it('returns failure when handler throws an exception', async () => {
      destinationsController.create.mockImplementationOnce(() => {
        throw new Error('Unexpected DB error');
      });

      const result = await executeAction(
        { id: 'action_throw', type: 'create_destination', payload: { name: 'Test' } },
        user
      );

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Unexpected DB error');
    });
  });

  // -------------------------------------------------------------------------
  // executeActions — batch processing
  // -------------------------------------------------------------------------

  describe('executeActions() — batch processing', () => {
    it('processes multiple actions in sequence and returns results array', async () => {
      const destData = { _id: 'dest-2', name: 'Seoul' };
      const expData = { _id: 'exp-2', name: 'Street Food Tour', destination: 'dest-2' };

      mockControllerSuccess(destinationsController.create, 201, destData);
      mockControllerSuccess(experiencesController.create, 201, expData);

      const actions = [
        { id: 'action_a1', type: 'create_destination', payload: { name: 'Seoul', country: 'South Korea' } },
        { id: 'action_a2', type: 'create_experience', payload: { name: 'Street Food Tour' } }
      ];

      const { results } = await executeActions(actions, user, null);

      expect(results).toHaveLength(2);
      expect(results[0].actionId).toBe('action_a1');
      expect(results[0].success).toBe(true);
      expect(results[1].actionId).toBe('action_a2');
      expect(results[1].success).toBe(true);
    });

    it('extracts destination_id from create_destination result into contextUpdates', async () => {
      mockControllerSuccess(destinationsController.create, 201, { _id: 'dest-ctx' });

      const { contextUpdates } = await executeActions(
        [{ id: 'action_ctx1', type: 'create_destination', payload: { name: 'Berlin', country: 'Germany' } }],
        user,
        null
      );

      expect(contextUpdates.destination_id).toBe('dest-ctx');
    });

    it('extracts experience_id and destination_id from create_experience result', async () => {
      mockControllerSuccess(experiencesController.create, 201, {
        _id: 'exp-ctx',
        destination: 'dest-linked'
      });

      const { contextUpdates } = await executeActions(
        [{ id: 'action_ctx2', type: 'create_experience', payload: { name: 'Tour', destination_id: 'dest-linked' } }],
        user,
        null
      );

      expect(contextUpdates.experience_id).toBe('exp-ctx');
      expect(contextUpdates.destination_id).toBe('dest-linked');
    });

    it('extracts plan_id from create_plan result', async () => {
      mockControllerSuccess(plansController.createPlan, 201, {
        _id: 'plan-ctx',
        experience: { _id: 'exp-linked' }
      });

      const { contextUpdates } = await executeActions(
        [{ id: 'action_ctx3', type: 'create_plan', payload: { experience_id: 'exp-linked' } }],
        user,
        null
      );

      expect(contextUpdates.plan_id).toBe('plan-ctx');
      expect(contextUpdates.experience_id).toBe('exp-linked');
    });

    it('calls session.markActionExecuted for each action', async () => {
      mockControllerSuccess(destinationsController.create, 201, { _id: 'dest-mark' });

      const session = makeSession();
      await executeActions(
        [{ id: 'action_mark1', type: 'create_destination', payload: { name: 'Dublin' } }],
        user,
        session
      );

      expect(session.markActionExecuted).toHaveBeenCalledWith('action_mark1', expect.objectContaining({
        success: true
      }));
    });

    it('calls session.updateContext when contextUpdates is non-empty', async () => {
      mockControllerSuccess(destinationsController.create, 201, { _id: 'dest-ctx-update' });

      const session = makeSession();
      await executeActions(
        [{ id: 'action_ctxup', type: 'create_destination', payload: { name: 'Lisbon' } }],
        user,
        session
      );

      expect(session.updateContext).toHaveBeenCalledWith(
        expect.objectContaining({ destination_id: 'dest-ctx-update' })
      );
    });

    it('continues processing remaining actions even if one fails', async () => {
      mockControllerError(destinationsController.create, 422, 'Invalid data');
      mockControllerSuccess(experiencesController.create, 201, { _id: 'exp-after-fail' });

      const { results } = await executeActions(
        [
          { id: 'action_fail', type: 'create_destination', payload: { name: 'Bad' } },
          { id: 'action_ok', type: 'create_experience', payload: { name: 'Good Tour' } }
        ],
        user,
        null
      );

      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);
    });

    it('rejects unknown action types without calling any controller', async () => {
      const { results } = await executeActions(
        [{ id: 'action_bad_type', type: 'drop_all_tables', payload: {} }],
        user,
        null
      );

      expect(results[0].success).toBe(false);
      expect(destinationsController.create).not.toHaveBeenCalled();
      expect(experiencesController.create).not.toHaveBeenCalled();
      expect(plansController.createPlan).not.toHaveBeenCalled();
    });

    it('returns empty arrays and contextUpdates when given no actions', async () => {
      const { results, contextUpdates } = await executeActions([], user, null);
      expect(results).toHaveLength(0);
      expect(Object.keys(contextUpdates)).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // select_destination
  // -------------------------------------------------------------------------

  describe('select_destination', () => {
    it('includes select_destination in ALLOWED_ACTION_TYPES', () => {
      expect(ALLOWED_ACTION_TYPES).toContain('select_destination');
    });

    it('executeAction select_destination returns destination_id in result body', async () => {
      const mockUser = { _id: 'user123', email: 'test@test.com' };
      const action = {
        id: 'action_test01',
        type: 'select_destination',
        payload: {
          destination_id: 'a'.repeat(24),
          destination_name: 'Tokyo',
          country: 'Japan',
          city: 'Tokyo'
        }
      };
      const result = await executeAction(action, mockUser);
      expect(result.statusCode).toBe(200);
      expect(result.body.data.destination_id).toBe('a'.repeat(24));
    });
  });

  // -------------------------------------------------------------------------
  // shift_plan_item_dates
  // -------------------------------------------------------------------------

  describe('shift_plan_item_dates', () => {
    it('includes shift_plan_item_dates in ALLOWED_ACTION_TYPES', () => {
      expect(ALLOWED_ACTION_TYPES).toContain('shift_plan_item_dates');
    });

    it('calls plansController.shiftPlanItemDates with diff_ms computed from diff_days', async () => {
      plansController.shiftPlanItemDates.mockImplementationOnce(async (req, res) => {
        res.json({ shifted_count: 3 });
      });

      const result = await executeAction(
        {
          id: 'action_spid01',
          type: 'shift_plan_item_dates',
          payload: { plan_id: 'plan-abc', diff_days: 7 }
        },
        user
      );

      expect(result.success).toBe(true);
      expect(plansController.shiftPlanItemDates).toHaveBeenCalledTimes(1);

      const req = plansController.shiftPlanItemDates.mock.calls[0][0];
      expect(req.params.id).toBe('plan-abc');
      expect(req.body.diff_ms).toBe(7 * 86400000);
      expect(req.user).toBe(user);
    });

    it('returns the result from plansController.shiftPlanItemDates', async () => {
      plansController.shiftPlanItemDates.mockImplementationOnce(async (req, res) => {
        res.json({ shifted_count: 5 });
      });

      const result = await executeAction(
        {
          id: 'action_spid02',
          type: 'shift_plan_item_dates',
          payload: { plan_id: 'plan-xyz', diff_days: -3 }
        },
        user
      );

      expect(result.success).toBe(true);
      expect(result.body.shifted_count).toBe(5);
    });
  });

  // -------------------------------------------------------------------------
  // executeUpdatePlan — auto-propose shift action
  // -------------------------------------------------------------------------

  describe('executeUpdatePlan — auto-propose shift_plan_item_dates', () => {
    it('pushes a shift_plan_item_dates pending action to session when _shift_meta is present with scheduled_items_count > 0', async () => {
      plansController.updatePlan.mockImplementationOnce(async (req, res) => {
        res.json({
          _id: 'plan-shift',
          planned_date: '2026-05-01',
          _shift_meta: {
            scheduled_items_count: 4,
            date_diff_days: 3,
            date_diff_ms: 3 * 86400000,
            old_date: '2026-04-28',
            new_date: '2026-05-01'
          }
        });
      });

      const session = { pending_actions: [] };

      await executeAction(
        {
          id: 'action_upd01',
          type: 'update_plan',
          payload: { plan_id: 'plan-shift', planned_date: '2026-05-01' }
        },
        user,
        session
      );

      expect(session.pending_actions).toHaveLength(1);
      const proposed = session.pending_actions[0];
      expect(proposed.type).toBe('shift_plan_item_dates');
      expect(proposed.payload.plan_id).toBe('plan-shift');
      expect(proposed.payload.diff_days).toBe(3);
      expect(proposed.executed).toBe(false);
      expect(proposed.id).toMatch(/^action_/);
      expect(proposed.description).toContain('4');
      expect(proposed.description).toContain('+3');
    });

    it('does NOT push a pending action when _shift_meta is absent', async () => {
      plansController.updatePlan.mockImplementationOnce(async (req, res) => {
        res.json({
          _id: 'plan-no-shift',
          planned_date: '2026-05-01'
        });
      });

      const session = { pending_actions: [] };

      await executeAction(
        {
          id: 'action_upd02',
          type: 'update_plan',
          payload: { plan_id: 'plan-no-shift', planned_date: '2026-05-01' }
        },
        user,
        session
      );

      expect(session.pending_actions).toHaveLength(0);
    });
  });
});
