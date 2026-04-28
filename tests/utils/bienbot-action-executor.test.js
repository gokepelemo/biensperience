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
 *
 * Mocking strategy (post bd #8667):
 *   - Canonical CRUD handlers (executeCreate{Destination,Experience,Plan},
 *     executeAddPlanItems, executeUpdatePlanItem, mark complete/incomplete,
 *     executeDeletePlan, plan-branch invite/remove collaborator) call services
 *     directly per bd #8f36.13 + bd #8667 — these tests mock at the service
 *     boundary and assert on service-method invocations.
 *   - Long-tail handlers (shift_plan_item_dates, update_plan, …) still
 *     delegate to controllers — these tests retain controller-boundary mocks
 *     and assertions.
 */

// Mock services for canonical handlers (bd #8f36.13 + bd #8667 path)
jest.mock('../../services/destination-service');
jest.mock('../../services/experience-service');
jest.mock('../../services/plan-service');

// Mock controllers for long-tail handlers that still delegate to controllers
jest.mock('../../controllers/api/destinations');
jest.mock('../../controllers/api/experiences');
jest.mock('../../controllers/api/plans');

const {
  executeAction,
  executeActions,
  ALLOWED_ACTION_TYPES
} = require('../../utilities/bienbot-action-executor');

const destinationService = require('../../services/destination-service');
const experienceService = require('../../services/experience-service');
const planService = require('../../services/plan-service');

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
 * Service-boundary mock helpers.
 * Services return `{ <dataKey>, error?, code? }` — see services/*.js contracts.
 */
function mockServiceSuccess(serviceFn, dataKey, data) {
  serviceFn.mockResolvedValueOnce({ [dataKey]: data });
}

function mockServiceError(serviceFn, code, errorMsg) {
  serviceFn.mockResolvedValueOnce({ error: errorMsg, code });
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
        'sync_plan',
        'list_user_experiences'
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
  // executeAction — create_destination (canonical handler — service mock)
  // -------------------------------------------------------------------------

  describe('executeAction() — create_destination', () => {
    it('calls destination service createDestination and returns success result', async () => {
      const destData = { _id: 'dest-1', name: 'Kyoto, Japan', country: 'Japan' };
      mockServiceSuccess(destinationService.createDestination, 'destination', destData);

      const result = await executeAction(
        {
          id: 'action_cd12345',
          type: 'create_destination',
          payload: { name: 'Kyoto, Japan', country: 'Japan' }
        },
        user
      );

      expect(result.success).toBe(true);
      expect(destinationService.createDestination).toHaveBeenCalledTimes(1);
    });

    it('returns failure when service returns error with 4xx code', async () => {
      mockServiceError(destinationService.createDestination, 422, 'Name already exists');

      const result = await executeAction(
        { id: 'action_cdbad', type: 'create_destination', payload: { name: 'Dupe' } },
        user
      );

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Name already exists');
    });
  });

  // -------------------------------------------------------------------------
  // executeAction — create_experience (canonical handler — service mock)
  // -------------------------------------------------------------------------

  describe('executeAction() — create_experience', () => {
    it('calls experience service createExperience with correct payload fields', async () => {
      const expData = { _id: 'exp-1', name: 'Cherry Blossom Tour' };
      mockServiceSuccess(experienceService.createExperience, 'experience', expData);

      const result = await executeAction(
        {
          id: 'action_ce12345',
          type: 'create_experience',
          payload: { name: 'Cherry Blossom Tour', destination_id: 'dest-1' }
        },
        user
      );

      expect(result.success).toBe(true);
      expect(experienceService.createExperience).toHaveBeenCalledTimes(1);

      // Service is called with { data: { name, destination, ... }, actor }
      const callArgs = experienceService.createExperience.mock.calls[0][0];
      expect(callArgs.data.name).toBe('Cherry Blossom Tour');
      expect(callArgs.data.destination).toBe('dest-1');
      expect(callArgs.actor).toBe(user);
    });
  });

  // -------------------------------------------------------------------------
  // executeAction — create_plan (canonical handler — service mock)
  // -------------------------------------------------------------------------

  describe('executeAction() — create_plan', () => {
    it('calls plan service createPlan with correct params', async () => {
      const planData = { _id: 'plan-1', experience: { _id: 'exp-1' } };
      mockServiceSuccess(planService.createPlan, 'plan', planData);

      const result = await executeAction(
        {
          id: 'action_cp12345',
          type: 'create_plan',
          payload: { experience_id: 'exp-1', planned_date: '2026-04-01' }
        },
        user
      );

      expect(result.success).toBe(true);
      expect(planService.createPlan).toHaveBeenCalledTimes(1);

      const callArgs = planService.createPlan.mock.calls[0][0];
      expect(callArgs.experienceId).toBe('exp-1');
      expect(callArgs.actor).toBe(user);
    });
  });

  // -------------------------------------------------------------------------
  // executeAction — error handling
  // -------------------------------------------------------------------------

  describe('executeAction() — error handling', () => {
    it('returns failure when handler throws an exception', async () => {
      destinationService.createDestination.mockImplementationOnce(() => {
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
  // executeActions — batch processing (canonical handlers — service mocks)
  // -------------------------------------------------------------------------

  describe('executeActions() — batch processing', () => {
    it('processes multiple actions in sequence and returns results array', async () => {
      const destData = { _id: 'dest-2', name: 'Seoul' };
      const expData = { _id: 'exp-2', name: 'Street Food Tour', destination: 'dest-2' };

      mockServiceSuccess(destinationService.createDestination, 'destination', destData);
      mockServiceSuccess(experienceService.createExperience, 'experience', expData);

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
      mockServiceSuccess(destinationService.createDestination, 'destination', { _id: 'dest-ctx' });

      const { contextUpdates } = await executeActions(
        [{ id: 'action_ctx1', type: 'create_destination', payload: { name: 'Berlin', country: 'Germany' } }],
        user,
        null
      );

      expect(contextUpdates.destination_id).toBe('dest-ctx');
    });

    it('extracts experience_id and destination_id from create_experience result', async () => {
      mockServiceSuccess(experienceService.createExperience, 'experience', {
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
      mockServiceSuccess(planService.createPlan, 'plan', {
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
      mockServiceSuccess(destinationService.createDestination, 'destination', { _id: 'dest-mark' });

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
      mockServiceSuccess(destinationService.createDestination, 'destination', { _id: 'dest-ctx-update' });

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
      mockServiceError(destinationService.createDestination, 422, 'Invalid data');
      mockServiceSuccess(experienceService.createExperience, 'experience', { _id: 'exp-after-fail' });

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

    it('rejects unknown action types without calling any service', async () => {
      const { results } = await executeActions(
        [{ id: 'action_bad_type', type: 'drop_all_tables', payload: {} }],
        user,
        null
      );

      expect(results[0].success).toBe(false);
      expect(destinationService.createDestination).not.toHaveBeenCalled();
      expect(experienceService.createExperience).not.toHaveBeenCalled();
      expect(planService.createPlan).not.toHaveBeenCalled();
    });

    it('returns empty arrays and contextUpdates when given no actions', async () => {
      const { results, contextUpdates } = await executeActions([], user, null);
      expect(results).toHaveLength(0);
      expect(Object.keys(contextUpdates)).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // select_destination
  //
  // This handler does NOT delegate to a service — it queries Destination
  // directly + permission-enforcer.canView. We mock the model + enforcer
  // narrowly with jest.spyOn so other handlers using these models in the
  // same suite are unaffected.
  // -------------------------------------------------------------------------

  describe('select_destination', () => {
    const Destination = require('../../models/destination');
    const permissionEnforcer = require('../../utilities/permission-enforcer');

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('includes select_destination in ALLOWED_ACTION_TYPES', () => {
      expect(ALLOWED_ACTION_TYPES).toContain('select_destination');
    });

    it('executeAction select_destination returns destination_id in result body', async () => {
      const destinationId = 'a'.repeat(24);
      const mockUser = { _id: '507f1f77bcf86cd799439011', email: 'test@test.com' };

      // Mock Destination.findById(...).select(...).lean() chain.
      const leanMock = jest.fn().mockResolvedValue({
        _id: destinationId,
        name: 'Tokyo',
        country: 'Japan'
      });
      const selectMock = jest.fn().mockReturnValue({ lean: leanMock });
      jest.spyOn(Destination, 'findById').mockReturnValue({ select: selectMock });

      // Mock permission enforcer to allow the canView check.
      jest.spyOn(permissionEnforcer, 'getEnforcer').mockReturnValue({
        canView: jest.fn().mockResolvedValue({ allowed: true })
      });

      const action = {
        id: 'action_test01',
        type: 'select_destination',
        payload: {
          destination_id: destinationId,
          destination_name: 'Tokyo',
          country: 'Japan',
          city: 'Tokyo'
        }
      };
      const result = await executeAction(action, mockUser);
      expect(result.statusCode).toBe(200);
      expect(result.body.data.destination_id).toBe(destinationId);
    });
  });

  // -------------------------------------------------------------------------
  // shift_plan_item_dates (long-tail — still delegates to controller)
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
  // (long-tail handler — still delegates to plansController.updatePlan)
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

    it('does NOT push a pending action when date_diff_days is 0', async () => {
      plansController.updatePlan.mockImplementationOnce(async (req, res) => {
        res.json({
          _id: 'plan-zero-diff',
          planned_date: '2026-05-01',
          _shift_meta: {
            scheduled_items_count: 3,
            date_diff_days: 0,
            date_diff_ms: 3600000, // < 12h, rounds to 0 days
            old_date: '2026-04-30T20:00:00.000Z',
            new_date: '2026-05-01T01:00:00.000Z'
          }
        });
      });

      const session = { pending_actions: [] };

      await executeAction(
        {
          id: 'action_upd03',
          type: 'update_plan',
          payload: { plan_id: 'plan-zero-diff', planned_date: '2026-05-01' }
        },
        user,
        session
      );

      expect(session.pending_actions).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // executeAction() — list_user_experiences
  // -------------------------------------------------------------------------

  describe('executeAction() — list_user_experiences', () => {
    const Experience = require('../../models/experience');

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('returns experiences owned by the target user', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockExperiences = [
        {
          _id: { toString: () => 'exp-1' },
          name: 'Food Tour',
          overview: 'Great eats',
          destination: { name: 'Paris', country: 'France' },
          plan_items: [1, 2, 3]
        },
        {
          _id: { toString: () => 'exp-2' },
          name: 'Art Walk',
          overview: null,
          destination: { name: 'Paris', country: 'France' },
          plan_items: []
        }
      ];

      const leanMock = jest.fn().mockResolvedValue(mockExperiences);
      const limitMock = jest.fn().mockReturnValue({ lean: leanMock });
      const selectMock = jest.fn().mockReturnValue({ limit: limitMock });
      const populateMock = jest.fn().mockReturnValue({ select: selectMock });
      jest.spyOn(Experience, 'find').mockReturnValue({ populate: populateMock });

      const result = await executeAction(
        {
          id: 'action_lue12345',
          type: 'list_user_experiences',
          payload: { user_id: userId }
        },
        makeUser()
      );

      expect(result.success).toBe(true);
      expect(result.result.experiences).toHaveLength(2);
      expect(result.result.experiences[0].name).toBe('Food Tour');
      expect(result.result.experiences[0].plan_item_count).toBe(3);
      expect(result.result.experiences[1].plan_item_count).toBe(0);
      expect(result.result.total).toBe(2);
      expect(result.result.user_id).toBe(userId);
    });

    it('returns empty list when user has no owned experiences', async () => {
      const userId = '507f1f77bcf86cd799439011';

      const leanMock = jest.fn().mockResolvedValue([]);
      const limitMock = jest.fn().mockReturnValue({ lean: leanMock });
      const selectMock = jest.fn().mockReturnValue({ limit: limitMock });
      const populateMock = jest.fn().mockReturnValue({ select: selectMock });
      jest.spyOn(Experience, 'find').mockReturnValue({ populate: populateMock });

      const result = await executeAction(
        {
          id: 'action_lue_empty',
          type: 'list_user_experiences',
          payload: { user_id: userId }
        },
        makeUser()
      );

      expect(result.success).toBe(true);
      expect(result.result.experiences).toHaveLength(0);
      expect(result.result.total).toBe(0);
    });

    it('returns error result when user_id is missing', async () => {
      const result = await executeAction(
        {
          id: 'action_lue_noid',
          type: 'list_user_experiences',
          payload: {}
        },
        makeUser()
      );

      expect(result.success).toBe(false);
    });
  });
});
