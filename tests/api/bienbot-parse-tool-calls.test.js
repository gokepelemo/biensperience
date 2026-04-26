const { parseLLMResponse } = require('../../controllers/api/bienbot');

describe('parseLLMResponse — tool_calls', () => {
  it('extracts tool_calls when present', () => {
    const raw = JSON.stringify({
      message: '',
      tool_calls: [
        { type: 'fetch_plan_items', payload: { plan_id: '507f1f77bcf86cd799439011', filter: 'unscheduled' } }
      ],
      pending_actions: []
    });
    const parsed = parseLLMResponse(raw);
    expect(parsed.tool_calls).toHaveLength(1);
    expect(parsed.tool_calls[0].type).toBe('fetch_plan_items');
    expect(parsed.tool_calls[0].payload.filter).toBe('unscheduled');
  });

  it('returns empty array when tool_calls absent', () => {
    const raw = JSON.stringify({ message: 'hi', pending_actions: [] });
    expect(parseLLMResponse(raw).tool_calls).toEqual([]);
  });

  it('drops tool_calls entries with unknown action types', () => {
    const raw = JSON.stringify({
      message: '',
      tool_calls: [
        { type: 'fetch_plan_items', payload: { plan_id: '507f1f77bcf86cd799439011' } },
        { type: 'fetch_garbage',   payload: {} }
      ]
    });
    expect(parseLLMResponse(raw).tool_calls).toHaveLength(1);
  });

  it('drops tool_calls entries missing payload', () => {
    const raw = JSON.stringify({
      message: '', tool_calls: [{ type: 'fetch_plan_items' }]
    });
    expect(parseLLMResponse(raw).tool_calls).toHaveLength(0);
  });
});
