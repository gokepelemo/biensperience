const { _executeToolCallLoopForTest } = require('../../controllers/api/bienbot');

describe('executeToolCallLoop', () => {
  const fakeUser = { _id: 'user-1' };

  it('executes a single fetch and returns its formatted result', async () => {
    const fakeExecuteAction = jest.fn().mockResolvedValue({
      success: true,
      result: { statusCode: 200, body: { items: [{ _id: 'i1', content: 'A' }], total: 1, returned: 1 } }
    });

    const out = await _executeToolCallLoopForTest({
      toolCalls: [{ type: 'fetch_plan_items', payload: { plan_id: 'p1' } }],
      user: fakeUser,
      session: {},
      executeAction: fakeExecuteAction,
      onCallStart: jest.fn(),
      onCallEnd: jest.fn()
    });

    expect(fakeExecuteAction).toHaveBeenCalledTimes(1);
    expect(out.toolResultsBlock).toContain('fetch_plan_items');
    expect(out.toolResultsBlock).toContain('"items"');
    expect(out.calls).toHaveLength(1);
    expect(out.calls[0].ok).toBe(true);
  });

  it('runs multiple fetches in parallel', async () => {
    const order = [];
    const fakeExecuteAction = jest.fn().mockImplementation(async (action) => {
      order.push(`start-${action.type}`);
      await new Promise(r => setTimeout(r, 20));
      order.push(`end-${action.type}`);
      return { success: true, result: { statusCode: 200, body: { ok: true } } };
    });

    await _executeToolCallLoopForTest({
      toolCalls: [
        { type: 'fetch_plan_items', payload: { plan_id: 'p1' } },
        { type: 'fetch_plan_items', payload: { plan_id: 'p2' } }
      ],
      user: fakeUser,
      session: {},
      executeAction: fakeExecuteAction,
      onCallStart: jest.fn(),
      onCallEnd: jest.fn()
    });

    expect(order.slice(0, 2)).toEqual(['start-fetch_plan_items', 'start-fetch_plan_items']);
  });

  it('formats failed fetches as { ok: false, error }', async () => {
    const fakeExecuteAction = jest.fn().mockResolvedValue({
      success: false,
      result: { statusCode: 403, body: { ok: false, error: 'not_authorized' } }
    });

    const out = await _executeToolCallLoopForTest({
      toolCalls: [{ type: 'fetch_plan_items', payload: { plan_id: 'p1' } }],
      user: fakeUser, session: {},
      executeAction: fakeExecuteAction,
      onCallStart: jest.fn(), onCallEnd: jest.fn()
    });

    expect(out.toolResultsBlock).toContain('"ok":false');
    expect(out.toolResultsBlock).toContain('not_authorized');
    expect(out.calls[0].ok).toBe(false);
  });

  it('treats thrown handler errors as fetch_failed', async () => {
    const fakeExecuteAction = jest.fn().mockRejectedValue(new Error('boom'));
    const out = await _executeToolCallLoopForTest({
      toolCalls: [{ type: 'fetch_plan_items', payload: { plan_id: 'p1' } }],
      user: fakeUser, session: {},
      executeAction: fakeExecuteAction,
      onCallStart: jest.fn(), onCallEnd: jest.fn()
    });
    expect(out.toolResultsBlock).toContain('fetch_failed');
    expect(out.calls[0].ok).toBe(false);
  });

  it('emits onCallStart before and onCallEnd after each call', async () => {
    const onCallStart = jest.fn();
    const onCallEnd = jest.fn();
    const fakeExecuteAction = jest.fn().mockResolvedValue({
      success: true, result: { statusCode: 200, body: { ok: true } }
    });

    await _executeToolCallLoopForTest({
      toolCalls: [{ type: 'fetch_plan_items', payload: { plan_id: 'p1' } }],
      user: fakeUser, session: {},
      executeAction: fakeExecuteAction, onCallStart, onCallEnd
    });

    expect(onCallStart).toHaveBeenCalledWith(expect.objectContaining({
      type: 'fetch_plan_items', label: 'Fetching plan items…'
    }));
    expect(onCallEnd).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });
});
