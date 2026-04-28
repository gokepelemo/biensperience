/**
 * Malformed-output prompt-injection telemetry test (bd #8f36.11).
 *
 * Verifies that when parseLLMResponse encounters anomalous LLM output
 * (unknown action types, malformed payloads, JSON parse fallback paths),
 * the resulting `_anomalies` field is populated and the generic
 * logAnomalousOutput helper emits a WARN log.
 */

jest.mock('../../utilities/backend-logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const logger = require('../../utilities/backend-logger');
const { parseLLMResponse } = require('../../controllers/api/bienbot');
const { logAnomalousOutput } = require('../../utilities/ai-gateway');

describe('Malformed-output telemetry — bd #8f36.11', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('attaches _anomalies with both unknown_action_types and malformed_payloads', () => {
    const llmOutput = JSON.stringify({
      message: 'OK',
      pending_actions: [
        // Malformed payload — missing required `name` + `country`
        {
          id: 'a1',
          type: 'create_destination',
          payload: { state: 'CA' },
          description: 'Create.'
        },
        // Unknown action type
        {
          id: 'a2',
          type: 'erase_database',
          payload: { confirm: true },
          description: 'Erase.'
        },
        // Valid action — should pass through
        {
          id: 'a3',
          type: 'create_destination',
          payload: { name: 'Lisbon', country: 'Portugal' },
          description: 'Create.'
        }
      ]
    });

    const parsed = parseLLMResponse(llmOutput);
    expect(parsed.pending_actions).toHaveLength(1);
    expect(parsed.pending_actions[0].id).toBe('a3');
    expect(parsed._anomalies.unknown_action_types).toContain('erase_database');
    expect(parsed._anomalies.malformed_payloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'create_destination' })
      ])
    );
  });

  it('logAnomalousOutput emits WARN when anomalies are present', () => {
    logAnomalousOutput('test-source', {
      unknown_action_types: ['phantom_action'],
      malformed_payloads: [{ type: 'create_plan', summary: 'experience_id: Required' }],
      parse_errors: 0
    }, { sessionId: 'sess_123' });

    expect(logger.warn).toHaveBeenCalledTimes(1);
    const [tag, payload] = logger.warn.mock.calls[0];
    expect(tag).toContain('[ai-gateway:anomaly:test-source]');
    expect(payload).toMatchObject({
      unknown_action_types: ['phantom_action'],
      parse_errors: 0,
      sessionId: 'sess_123'
    });
    expect(payload.malformed_payloads[0]).toMatchObject({ type: 'create_plan' });
  });

  it('logAnomalousOutput emits DEBUG (not WARN) when output is clean', () => {
    logAnomalousOutput('test-source', {
      unknown_action_types: [],
      malformed_payloads: [],
      parse_errors: 0
    });

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledTimes(1);
  });

  it('counts parse_errors when LLM emits JSON-like-but-broken output', () => {
    // Trailing comma + unterminated string → JSON.parse fails on the cleaned
    // path, salvage path runs, parse_errors should increment.
    const broken = '{"message": "I tried but the JSON is broken,';
    const parsed = parseLLMResponse(broken);
    // We don't care about the exact message — just that we routed through the
    // fallback path and the counter incremented.
    expect(parsed._anomalies.parse_errors).toBeGreaterThan(0);
  });

  it('drops malformed tool_calls and tracks them in anomalies', () => {
    const llmOutput = JSON.stringify({
      message: '',
      tool_calls: [
        // Missing plan_id (required for fetch_plan_items)
        { type: 'fetch_plan_items', payload: { filter: 'unscheduled' } },
        // Valid
        { type: 'fetch_plan_items', payload: { plan_id: '507f1f77bcf86cd799439011' } }
      ]
    });
    const parsed = parseLLMResponse(llmOutput);
    expect(parsed.tool_calls).toHaveLength(1);
    expect(parsed.tool_calls[0].payload.plan_id).toBe('507f1f77bcf86cd799439011');
    expect(parsed._anomalies.malformed_payloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'fetch_plan_items' })
      ])
    );
  });
});
