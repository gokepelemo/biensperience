const { parseLLMResponse } = require('../../controllers/api/bienbot');

describe('parseLLMResponse — placeholder entity refs', () => {
  it('passes through ⟦entity:N⟧ placeholders untouched in the message', () => {
    const raw = JSON.stringify({
      message: 'I will create a plan for ⟦entity:0⟧!',
      entity_refs: [
        { type: 'experience', _id: '693f214a2b3c4d5e6f7a8b9c', name: 'Tokyo Temple Tour' }
      ],
      pending_actions: []
    });
    const parsed = parseLLMResponse(raw);
    expect(parsed.message).toBe('I will create a plan for ⟦entity:0⟧!');
    expect(parsed.entity_refs).toHaveLength(1);
    expect(parsed.entity_refs[0]._id).toBe('693f214a2b3c4d5e6f7a8b9c');
  });

  it('rewrites legacy inline-JSON entity blocks to ⟦entity:N⟧ placeholders and merges into entity_refs', () => {
    // Properly-escaped inline JSON inside the message — the legacy "happy" path
    const raw = JSON.stringify({
      message: 'I will create a plan for {"_id":"693f214a2b3c4d5e6f7a8b9c","name":"Tokyo","type":"experience"}!',
      entity_refs: [],
      pending_actions: []
    });
    const parsed = parseLLMResponse(raw);
    expect(parsed.message).toContain('⟦entity:0⟧');
    expect(parsed.message).not.toContain('"_id"');
    expect(parsed.entity_refs).toHaveLength(1);
    expect(parsed.entity_refs[0]._id).toBe('693f214a2b3c4d5e6f7a8b9c');
  });

  it('repairs unescaped inline-JSON envelope and recovers the full message', () => {
    // The exact failure mode from the bug report: LLM emits unescaped inline
    // entity JSON that breaks the outer JSON envelope. Without the repair,
    // the fallback regex truncates "Did you mean " at the first unescaped quote.
    const raw =
      '{"message":"I found two Casablanca plans. Did you mean {"_id":"693f214a2b3c4d5e6f7a8b9c","name":"Casablanca","type":"plan"}?","entity_refs":[],"pending_actions":[]}';
    const parsed = parseLLMResponse(raw);
    expect(parsed.message).toContain('I found two Casablanca plans');
    expect(parsed.message).toContain('Casablanca');
    expect(parsed.message).not.toMatch(/\{$/); // never ends with a stray brace
    // After repair, the legacy harvest pass converts the inline JSON to placeholder
    expect(parsed.entity_refs.length).toBeGreaterThan(0);
    expect(parsed.entity_refs[0].name).toBe('Casablanca');
  });

  it('does not truncate at the first unescaped quote when the message ends naturally', () => {
    const raw = JSON.stringify({
      message: 'A plain message with no inline JSON. End.',
      entity_refs: [],
      pending_actions: []
    });
    const parsed = parseLLMResponse(raw);
    expect(parsed.message).toBe('A plain message with no inline JSON. End.');
  });

  it('returns a friendly error when the response is hopelessly malformed', () => {
    const raw = '{"message":"abc';
    const parsed = parseLLMResponse(raw);
    // Either recovers a partial message OR returns the friendly error — never crashes
    expect(typeof parsed.message).toBe('string');
    expect(parsed.message.length).toBeGreaterThan(0);
  });
});
