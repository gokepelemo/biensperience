/**
 * Tests for src/utilities/ai/functions/generate-tips.js
 *
 * Validates the parser pipeline applied to `data.tips` returned by
 * POST /api/ai/generate-tips. The backend currently returns free-form text
 * (typically a numbered list per the `generate_tips` system prompt), but the
 * parser must accept JSON arrays, fenced JSON, bullet lists, quoted lines,
 * and degrade gracefully on garbage input.
 */

// Mock the request wrapper so tests don't hit the network.
jest.mock('../../../../src/utilities/ai/functions/_request', () => ({
  postAIRequest: jest.fn()
}));

// Quiet the logger.
jest.mock('../../../../src/utilities/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

import { generateTravelTips } from '../../../../src/utilities/ai/functions/generate-tips';
import { postAIRequest } from '../../../../src/utilities/ai/functions/_request';

function mockTipsResponse(tipsString) {
  postAIRequest.mockResolvedValueOnce({ tips: tipsString });
}

describe('generateTravelTips parser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('parses a JSON array response', async () => {
    mockTipsResponse('["Bring sunscreen","Carry cash","Learn basic Spanish"]');
    const tips = await generateTravelTips({ destination: 'Mexico City' });
    expect(tips).toEqual(['Bring sunscreen', 'Carry cash', 'Learn basic Spanish']);
  });

  test('parses a markdown-fenced JSON array response', async () => {
    mockTipsResponse('```json\n["Tip A","Tip B","Tip C"]\n```');
    const tips = await generateTravelTips({ destination: 'Tokyo' });
    expect(tips).toEqual(['Tip A', 'Tip B', 'Tip C']);
  });

  test('parses a numbered-list fallback', async () => {
    mockTipsResponse('1. Tip A\n2. Tip B\n3. Tip C');
    const tips = await generateTravelTips({ destination: 'Paris' });
    expect(tips).toEqual(['Tip A', 'Tip B', 'Tip C']);
  });

  test('parses a bullet-list fallback', async () => {
    mockTipsResponse('- Tip A\n- Tip B\n* Tip C\n• Tip D');
    const tips = await generateTravelTips({ destination: 'Lisbon' });
    expect(tips).toEqual(['Tip A', 'Tip B', 'Tip C', 'Tip D']);
  });

  test('parses quoted tips and strips quotes', async () => {
    mockTipsResponse('"Tip A"\n"Tip B"\n"Tip C"');
    const tips = await generateTravelTips({ destination: 'Rome' });
    expect(tips).toEqual(['Tip A', 'Tip B', 'Tip C']);
  });

  test('handles mixed garbage without crashing', async () => {
    mockTipsResponse('   \n\n   '); // whitespace only
    const tips = await generateTravelTips({ destination: 'Nowhere' });
    expect(Array.isArray(tips)).toBe(true);
    expect(tips).toEqual([]);
  });

  test('respects the count limit when more tips are returned', async () => {
    mockTipsResponse('1. A\n2. B\n3. C\n4. D\n5. E\n6. F');
    const tips = await generateTravelTips({ destination: 'Berlin' }, { count: 3 });
    expect(tips).toEqual(['A', 'B', 'C']);
  });

  test('forwards prompts override and provider in request body', async () => {
    mockTipsResponse('["X","Y"]');
    await generateTravelTips(
      { destination: 'Cairo', country: 'Egypt' },
      {
        category: 'safety',
        count: 2,
        prompts: { generate_tips: 'custom' },
        provider: 'openai'
      }
    );
    expect(postAIRequest).toHaveBeenCalledWith(
      'generate-tips',
      expect.objectContaining({
        destination: 'Cairo',
        category: 'safety',
        count: 2,
        options: expect.objectContaining({
          prompts: { generate_tips: 'custom' },
          provider: 'openai',
          country: 'Egypt'
        })
      })
    );
  });

  test('returns empty array if backend returns no tips field', async () => {
    postAIRequest.mockResolvedValueOnce({});
    const tips = await generateTravelTips({ destination: 'Anywhere' });
    expect(tips).toEqual([]);
  });
});
