/**
 * Unit tests for change-formatter utility
 */

import {
  formatChanges,
  formatFieldName,
  getFieldIcon,
  summarizeChanges
} from '../../src/utilities/change-formatter';

describe('formatFieldName', () => {
  test('converts snake_case to Title Case', () => {
    expect(formatFieldName('cost_estimate')).toBe('Cost Estimate');
    expect(formatFieldName('max_planning_days')).toBe('Max Planning Days');
  });

  test('converts camelCase to Title Case', () => {
    expect(formatFieldName('costEstimate')).toBe('Cost Estimate');
    expect(formatFieldName('maxPlanningDays')).toBe('Max Planning Days');
  });

  test('converts PascalCase to Title Case', () => {
    expect(formatFieldName('CostEstimate')).toBe('Cost Estimate');
    expect(formatFieldName('MaxPlanningDays')).toBe('Max Planning Days');
  });

  test('handles ALL_CAPS', () => {
    expect(formatFieldName('API_KEY')).toBe('Api Key');
  });

  test('handles single words', () => {
    expect(formatFieldName('name')).toBe('Name');
    expect(formatFieldName('NAME')).toBe('Name');
  });

  test('handles empty string', () => {
    expect(formatFieldName('')).toBe('');
  });
});

describe('getFieldIcon', () => {
  test('returns icon for common fields', () => {
    expect(getFieldIcon('name')).toBe('🏷️');
    expect(getFieldIcon('description')).toBe('📝');
    expect(getFieldIcon('email')).toBe('📧');
    expect(getFieldIcon('cost_estimate')).toBe('💰');
  });

  test('returns entity-specific icon when provided', () => {
    expect(getFieldIcon('name', 'experience')).toBe('🏷️');
  });

  test('returns default icon for unknown fields', () => {
    expect(getFieldIcon('unknown_field')).toBe('📝');
  });
});

describe('formatChanges - simple values', () => {
  test('formats simple string changes', () => {
    const result = formatChanges('name', { from: 'Paris', to: 'Paris, France' });
    expect(result).toContain('Name');
    expect(result).toContain('Paris');
    expect(result).toContain('Paris, France');
    expect(result).toContain('→');
  });

  test('formats null to value changes', () => {
    const result = formatChanges('description', { from: null, to: 'New description' });
    expect(result).toContain('Description');
    expect(result).toContain('None');
    expect(result).toContain('New description');
  });

  test('formats value to null changes', () => {
    const result = formatChanges('description', { from: 'Old description', to: null });
    expect(result).toContain('Description');
    expect(result).toContain('Old description');
    expect(result).toContain('None');
  });

  test('formats boolean changes', () => {
    const result = formatChanges('isActive', { from: true, to: false });
    expect(result).toContain('Is Active');
    expect(result).toContain('Yes');
    expect(result).toContain('No');
  });
});

describe('formatChanges - numeric values', () => {
  test('formats numeric changes with delta', () => {
    const result = formatChanges('count', { from: 5, to: 10 });
    expect(result).toContain('Count');
    expect(result).toContain('+5');
  });

  test('formats negative delta', () => {
    const result = formatChanges('count', { from: 10, to: 5 });
    expect(result).toContain('-5');
  });

  test('formats cost fields with currency', () => {
    const result = formatChanges('cost_estimate', { from: 100, to: 150 }, 'experience');
    expect(result).toContain('Cost Estimate');
    expect(result).toContain('+$50');
  });

  test('formats negative cost delta', () => {
    const result = formatChanges('cost_estimate', { from: 150, to: 100 });
    expect(result).toContain('-$50');
  });

  test('formats price fields with currency', () => {
    const result = formatChanges('price', { from: 25, to: 30 });
    expect(result).toContain('Price');
    expect(result).toContain('+$5');
  });

  test('formats budget fields with currency', () => {
    const result = formatChanges('budget', { from: 1000, to: 1200 });
    expect(result).toContain('Budget');
    expect(result).toContain('+$200');
  });
});

describe('formatChanges - arrays of primitives', () => {
  test('formats added array items', () => {
    const result = formatChanges('tags', { from: ['a', 'b'], to: ['a', 'b', 'c'] });
    expect(result).toContain('New');
    expect(result).toContain('c');
  });

  test('formats removed array items', () => {
    const result = formatChanges('tags', { from: ['a', 'b', 'c'], to: ['a', 'b'] });
    expect(result).toContain('Removed');
    expect(result).toContain('c');
  });

  test('formats multiple added items', () => {
    const result = formatChanges('tags', { from: ['a'], to: ['a', 'b', 'c', 'd'] });
    expect(result).toContain('New');
    expect(result).toContain('(3)');
    expect(result).toContain('b');
    expect(result).toContain('c');
    expect(result).toContain('d');
  });

  test('formats multiple removed items', () => {
    const result = formatChanges('tags', { from: ['a', 'b', 'c', 'd'], to: ['a'] });
    expect(result).toContain('Removed');
    expect(result).toContain('(3)');
    expect(result).toContain('b');
    expect(result).toContain('c');
    expect(result).toContain('d');
  });
});

describe('formatChanges - arrays of objects', () => {
  test('formats added objects with IDs (performance optimization)', () => {
    const from = [{ _id: '1', name: 'Item 1' }];
    const to = [{ _id: '1', name: 'Item 1' }, { _id: '2', name: 'Item 2' }];
    const result = formatChanges('items', { from, to });
    expect(result).toContain('Added 1 item');
  });

  test('formats removed objects with IDs', () => {
    const from = [{ _id: '1', name: 'Item 1' }, { _id: '2', name: 'Item 2' }];
    const to = [{ _id: '1', name: 'Item 1' }];
    const result = formatChanges('items', { from, to });
    expect(result).toContain('Removed 1 item');
  });

  test('formats objects without IDs (fallback to deep comparison)', () => {
    const from = [{ name: 'Item 1' }];
    const to = [{ name: 'Item 1' }, { name: 'Item 2' }];
    const result = formatChanges('items', { from, to });
    expect(result).toContain('Added 1 item');
  });

  test('handles empty arrays', () => {
    const result = formatChanges('items', { from: [], to: [{ _id: '1', name: 'Item 1' }] });
    expect(result).toContain('Added 1 item');
  });
});

describe('formatChanges - travel tips', () => {
  test('formats added simple string tips', () => {
    const from = ['Tip 1'];
    const to = ['Tip 1', 'Tip 2'];
    const result = formatChanges('travel_tips', { from, to });
    expect(result).toContain('💡 New Tip: 💡 Tip 2');
  });

  test('formats removed simple string tips', () => {
    const from = ['Tip 1', 'Tip 2'];
    const to = ['Tip 1'];
    const result = formatChanges('travel_tips', { from, to });
    expect(result).toContain('💡 Removed Tip: 💡 Tip 2');
  });

  test('formats added structured tips', () => {
    const from = [];
    const to = [{
      type: 'Currency',
      value: 'Euro (EUR) is the official currency',
      note: 'Credit cards widely accepted',
      exchangeRate: '1 USD ≈ 0.85 EUR',
      icon: '💶',
      callToAction: {
        label: 'Check Current Rate',
        url: 'https://www.xe.com'
      }
    }];
    const result = formatChanges('travel_tips', { from, to });
    expect(result).toContain('💡 New Currency Tip: 💶 Euro (EUR) is the official currency');
    expect(result).toContain('Note: Credit cards widely accepted');
    expect(result).toContain('1 USD ≈ 0.85 EUR');
    expect(result).toContain('Link: Check Current Rate');
  });

  test('formats removed structured tips', () => {
    const from = [{
      type: 'Language',
      value: 'English widely spoken',
      note: 'Learn basic phrases',
      icon: '🗣️'
    }];
    const to = [];
    const result = formatChanges('travel_tips', { from, to });
    expect(result).toContain('💡 Removed Language Tip: 🗣️ English widely spoken');
    expect(result).toContain('Note: Learn basic phrases');
  });

  test('handles mixed simple and structured tips', () => {
    const from = ['Simple tip'];
    const to = [{
      type: 'Safety',
      value: 'Stay vigilant',
      note: 'Keep valuables secure',
      icon: '🛡️'
    }];
    const result = formatChanges('travel_tips', { from, to });
    expect(result).toContain('💡 Removed Tip: 💡 Simple tip');
    expect(result).toContain('💡 New Safety Tip: 🛡️ Stay vigilant');
  });
});

describe('formatChanges - dates', () => {
  test('formats date changes', () => {
    const from = new Date('2024-01-01');
    const to = new Date('2024-12-31');
    const result = formatChanges('plannedDate', { from, to });
    expect(result).toContain('Planned Date');
    expect(result).toContain('→');
  });

  test('formats ISO date strings', () => {
    const result = formatChanges('plannedDate', {
      from: '2024-01-01T00:00:00.000Z',
      to: '2024-12-31T00:00:00.000Z'
    });
    expect(result).toContain('Planned Date');
    expect(result).toContain('→');
  });
});

describe('formatChanges - objects', () => {
  test('formats added object keys', () => {
    const from = { a: 1 };
    const to = { a: 1, b: 2 };
    const result = formatChanges('metadata', { from, to });
    expect(result).toContain('Added 1 field');
    expect(result).toContain('B');
  });

  test('formats removed object keys', () => {
    const from = { a: 1, b: 2 };
    const to = { a: 1 };
    const result = formatChanges('metadata', { from, to });
    expect(result).toContain('Removed 1 field');
    expect(result).toContain('B');
  });

  test('formats changed object values', () => {
    const from = { a: 1, b: 2 };
    const to = { a: 1, b: 3 };
    const result = formatChanges('metadata', { from, to });
    expect(result).toContain('Updated 1 field');
    expect(result).toContain('B');
    expect(result).toContain('2');
    expect(result).toContain('3');
  });
});

describe('formatChanges - entity types', () => {
  test('uses entity type for icon selection', () => {
    const result = formatChanges('name', { from: 'A', to: 'B' }, 'destination');
    expect(result).toContain('🏷️');
  });

  test('formats experience fields', () => {
    const result = formatChanges('cost_estimate', { from: 100, to: 150 }, 'experience');
    expect(result).toContain('💰');
    expect(result).toContain('Cost Estimate');
  });

  test('formats profile fields', () => {
    const result = formatChanges('email', { from: 'old@test.com', to: 'new@test.com' }, 'profile');
    expect(result).toContain('📧');
  });
});

describe('summarizeChanges', () => {
  test('summarizes multiple changes', () => {
    const changes = {
      name: { from: 'Old Name', to: 'New Name' },
      cost_estimate: { from: 100, to: 150 }
    };
    const result = summarizeChanges(changes, 'experience');
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('Name');
    expect(result[1]).toContain('Cost Estimate');
    expect(result[1]).toContain('+$50');
  });

  test('handles empty changes', () => {
    const result = summarizeChanges({});
    expect(result).toHaveLength(0);
  });

  test('includes entity type in all summaries', () => {
    const changes = {
      name: { from: 'A', to: 'B' },
      description: { from: 'C', to: 'D' }
    };
    const result = summarizeChanges(changes, 'destination');
    expect(result).toHaveLength(2);
  });
});

describe('edge cases and error handling', () => {
  test('handles undefined values', () => {
    const result = formatChanges('field', { from: undefined, to: 'value' });
    expect(result).toContain('None');
    expect(result).toContain('value');
  });

  test('handles very long strings', () => {
    const longString = 'a'.repeat(1000);
    const result = formatChanges('description', { from: 'short', to: longString });
    expect(result).toContain('Description');
  });

  test('handles deeply nested objects (max depth protection)', () => {
    // Create a deeply nested object (15 levels deep)
    let deepObj1 = { value: 1 };
    let deepObj2 = { value: 2 };
    for (let i = 0; i < 15; i++) {
      deepObj1 = { nested: deepObj1 };
      deepObj2 = { nested: deepObj2 };
    }

    const result = formatChanges('data', { from: deepObj1, to: deepObj2 });
    expect(result).toContain('Data');
  });

  test('handles circular references gracefully', () => {
    const obj1 = { a: 1 };
    obj1.self = obj1; // Circular reference

    const obj2 = { a: 2 };
    obj2.self = obj2; // Circular reference

    // This should not throw an error or hang
    expect(() => {
      formatChanges('data', { from: obj1, to: obj2 });
    }).not.toThrow();
  });

  test('handles special characters in field names', () => {
    const result = formatChanges('field_with_$pecial_chars', { from: 'a', to: 'b' });
    expect(result).toContain('Field With $pecial Chars');
  });

  test('handles numeric field names', () => {
    const result = formatChanges('field123', { from: 'a', to: 'b' });
    expect(result).toContain('Field123');
  });
});

describe('performance tests', () => {
  test('handles large arrays efficiently (ID-based comparison)', () => {
    const startTime = Date.now();

    const from = Array.from({ length: 1000 }, (_, i) => ({ _id: String(i), name: `Item ${i}` }));
    const to = [...from, { _id: '1000', name: 'New Item' }];

    const result = formatChanges('items', { from, to });

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(result).toContain('Added 1 item');
    expect(duration).toBeLessThan(100); // Should complete in under 100ms
  });

  test('handles multiple changes efficiently', () => {
    const changes = {};
    for (let i = 0; i < 50; i++) {
      changes[`field${i}`] = { from: i, to: i + 1 };
    }

    const startTime = Date.now();
    const result = summarizeChanges(changes);
    const endTime = Date.now();

    expect(result).toHaveLength(50);
    expect(endTime - startTime).toBeLessThan(50); // Should complete in under 50ms
  });
});
