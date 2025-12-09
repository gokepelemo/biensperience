/**
 * Tests for paquette-utils - Easter Egg Utility
 * @jest-environment jsdom
 */

import {
  addEasterEgg,
  addEasterEggToParagraph,
  registerEasterEgg,
  getEasterEggs,
  clearEasterEggs,
} from '../paquette-utils';

describe('paquette-utils', () => {
  
  describe('addEasterEgg', () => {
    it('should return original text when probability is 0', () => {
      const text = 'Browse amazing destinations.';
      const result = addEasterEgg(text, { probability: 0 });
      expect(result).toBe(text);
    });

    it('should add Easter egg when probability is 1', () => {
      const text = 'Browse amazing destinations.';
      const result = addEasterEgg(text, { probability: 1, seed: 12345 });
      expect(result).toContain('Explore, dream, discover');
      expect(result.length).toBeGreaterThan(text.length);
    });

    it('should work with seeded random for deterministic behavior', () => {
      const text = 'Browse amazing destinations.';
      const result1 = addEasterEgg(text, { probability: 1, seed: 12345 });
      const result2 = addEasterEgg(text, { probability: 1, seed: 12345 });
      expect(result1).toBe(result2);
    });

    it('should return original text when text is too short', () => {
      const text = 'Short text.';
      const result = addEasterEgg(text, { probability: 1, minTextLength: 50 });
      expect(result).toBe(text);
    });

    it('should handle null/undefined text gracefully', () => {
      expect(addEasterEgg(null)).toBe(null);
      expect(addEasterEgg(undefined)).toBe(undefined);
      expect(addEasterEgg('')).toBe('');
    });

    it('should respect sentence boundaries', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const result = addEasterEgg(text, { 
        probability: 1, 
        seed: 12345,
        respectSentences: true 
      });
      expect(result).toContain('Explore, dream, discover');
      // Should be inserted at a sentence boundary
      expect(result).toMatch(/\.\s+[A-Z]/);
    });

    it('should capitalize Easter egg when asNewSentence is true', () => {
      const text = 'Browse amazing destinations.';
      const result = addEasterEgg(text, { 
        probability: 1, 
        seed: 12345,
        asNewSentence: true 
      });
      // Should start with capital E
      expect(result).toMatch(/Explore, dream, discover/);
    });

    it('should use different categories', () => {
      const text = 'Browse amazing destinations.';
      
      const taglineResult = addEasterEgg(text, { 
        probability: 1, 
        seed: 12345,
        category: 'tagline' 
      });
      expect(taglineResult).toContain('Explore, dream, discover');
      
      const subtleResult = addEasterEgg(text, { 
        probability: 1, 
        seed: 54321,
        category: 'subtle' 
      });
      // Should contain one of the subtle phrases
      const hasSubtle = ['What will you discover next?', 'Your adventure begins here.', 'Every destination tells a story.']
        .some(phrase => subtleResult.includes(phrase));
      expect(hasSubtle).toBe(true);
    });
  });

  describe('addEasterEggToParagraph', () => {
    it('should break paragraph into sentences and add Easter egg', () => {
      const paragraph = 'Start planning your adventure. Browse destinations. Create your plan.';
      const result = addEasterEggToParagraph(paragraph, { 
        probability: 1, 
        seed: 12345 
      });
      expect(result).toContain('Explore, dream, discover');
      expect(result.length).toBeGreaterThan(paragraph.length);
    });

    it('should handle paragraph with no sentences', () => {
      const paragraph = 'Short text';
      const result = addEasterEggToParagraph(paragraph, { probability: 0 });
      expect(result).toBe(paragraph);
    });

    it('should return original when probability is 0', () => {
      const paragraph = 'Start planning. Browse destinations. Create plan.';
      const result = addEasterEggToParagraph(paragraph, { probability: 0 });
      expect(result).toBe(paragraph);
    });
  });

  describe('registerEasterEgg', () => {
    afterEach(() => {
      clearEasterEggs('test');
    });

    it('should register a new Easter egg', () => {
      registerEasterEgg('test', 'Test phrase');
      const eggs = getEasterEggs('test');
      expect(eggs).toContain('Test phrase');
    });

    it('should not duplicate existing Easter eggs', () => {
      registerEasterEgg('test', 'Test phrase');
      registerEasterEgg('test', 'Test phrase');
      const eggs = getEasterEggs('test');
      expect(eggs.filter(e => e === 'Test phrase').length).toBe(1);
    });

    it('should create new category if it does not exist', () => {
      registerEasterEgg('newCategory', 'New phrase');
      const eggs = getEasterEggs('newCategory');
      expect(eggs).toContain('New phrase');
    });
  });

  describe('getEasterEggs', () => {
    it('should return all Easter eggs when category is "all"', () => {
      const allEggs = getEasterEggs('all');
      expect(allEggs.length).toBeGreaterThan(0);
      expect(allEggs).toContain('Explore, dream, discover.');
    });

    it('should return category-specific Easter eggs', () => {
      const taglineEggs = getEasterEggs('tagline');
      expect(taglineEggs).toContain('Explore, dream, discover.');
    });

    it('should return empty array for non-existent category', () => {
      const eggs = getEasterEggs('nonexistent');
      expect(eggs).toEqual([]);
    });
  });

  describe('clearEasterEggs', () => {
    it('should clear all Easter eggs in a category', () => {
      registerEasterEgg('test', 'Test phrase 1');
      registerEasterEgg('test', 'Test phrase 2');
      
      let eggs = getEasterEggs('test');
      expect(eggs.length).toBe(2);
      
      clearEasterEggs('test');
      eggs = getEasterEggs('test');
      expect(eggs.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle text with multiple sentence types', () => {
      const text = 'Are you ready? Yes! Let\'s go. Amazing.';
      const result = addEasterEgg(text, { probability: 1, seed: 12345 });
      expect(result).toBeTruthy();
    });

    it('should handle text with abbreviations', () => {
      const text = 'Dr. Smith went to Washington D.C. in the U.S.A.';
      const result = addEasterEgg(text, { probability: 1, seed: 12345 });
      expect(result).toBeTruthy();
    });

    it('should handle very long text', () => {
      const text = 'This is a very long text. '.repeat(50);
      const result = addEasterEgg(text, { probability: 1, seed: 12345 });
      expect(result).toContain('Explore, dream, discover');
    });
  });

  describe('probability distribution', () => {
    it('should respect probability over multiple runs', () => {
      const text = 'Browse amazing destinations.';
      const iterations = 1000;
      const probability = 0.3;
      let successCount = 0;

      for (let i = 0; i < iterations; i++) {
        const result = addEasterEgg(text, { probability });
        if (result !== text) {
          successCount++;
        }
      }

      // Success rate should be approximately 30% (within 5% margin)
      const successRate = successCount / iterations;
      expect(successRate).toBeGreaterThan(probability - 0.05);
      expect(successRate).toBeLessThan(probability + 0.05);
    });
  });
});
