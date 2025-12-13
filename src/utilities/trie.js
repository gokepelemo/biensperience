/**
 * Generic Trie Data Structure for Fast String Filtering
 *
 * A reusable Trie implementation for efficient prefix matching and autocomplete
 * across any data structure with string fields.
 *
 * Use cases:
 * - Search/filter users by name or email
 * - Search/filter destinations by name, city, or country
 * - Search/filter experiences by title or description
 * - Search/filter plan items by text
 * - Autocomplete suggestions for any text field
 *
 * Performance:
 * - Insert: O(k) where k = length of string
 * - Search: O(m) where m = length of query
 * - Memory: O(n * k) where n = number of strings, k = average length
 *
 * Ranking scores (higher = better match):
 * - SCORE_EXACT_MATCH (1000): Exact field match "Paris" === "Paris"
 * - SCORE_EXACT_WORD (500): Exact word in field "Paris" in "Paris, France"
 * - SCORE_STARTS_WITH (300): Field starts with query "Par" → "Paris"
 * - SCORE_WORD_STARTS (200): Word starts with query "Fra" → "Paris, France"
 * - SCORE_CONTAINS (100): Field contains query "ari" → "Paris"
 * - SCORE_PREFIX_MATCH (50): Trie prefix match (base)
 *
 * Field weight multiplier:
 * - Field scores are used as multipliers (normalized to 0.5-2.0 range)
 * - score: 50 = 1.0x multiplier (default)
 * - score: 100 = 1.5x multiplier
 * - score: 200 = 2.0x multiplier
 * - Higher field scores boost matches in important fields (e.g., name vs description)
 */

// Ranking score constants
const SCORE_EXACT_MATCH = 1000;   // Exact field match
const SCORE_EXACT_WORD = 500;    // Exact word match within field
const SCORE_STARTS_WITH = 300;   // Field starts with query
const SCORE_WORD_STARTS = 200;   // Word in field starts with query
const SCORE_CONTAINS = 100;      // Field contains query substring
const SCORE_PREFIX_MATCH = 50;   // Basic trie prefix match

/**
 * TrieNode - Node in the trie tree
 */
class TrieNode {
  constructor() {
    this.children = new Map();
    this.isEndOfWord = false;
    this.itemIndices = new Set(); // Indices of items containing this prefix
    this.score = 0; // For ranking results
    this.metadata = {}; // Additional data (e.g., field name, word position)
  }
}

/**
 * Trie - Core trie data structure
 */
class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  /**
   * Insert a word into the trie
   * @param {string} word - Word to insert
   * @param {number} itemIndex - Index of the item in the collection
   * @param {number} score - Score for ranking (higher = more important)
   * @param {Object} metadata - Additional metadata about this word
   */
  insert(word, itemIndex, score = 1, metadata = {}) {
    if (!word || typeof word !== 'string') return;

    const normalizedWord = word.toLowerCase().trim();
    if (normalizedWord.length === 0) return;

    let node = this.root;

    for (const char of normalizedWord) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char);
      node.itemIndices.add(itemIndex);
    }

    node.isEndOfWord = true;
    node.score = Math.max(node.score, score);
    node.metadata = { ...node.metadata, ...metadata };
  }

  /**
   * Search for items matching a prefix
   * @param {string} prefix - Prefix to search for
   * @returns {Set<number>} Set of item indices matching the prefix
   */
  search(prefix) {
    if (!prefix || typeof prefix !== 'string') return new Set();

    const normalizedPrefix = prefix.toLowerCase().trim();
    if (normalizedPrefix.length === 0) return new Set();

    let node = this.root;

    for (const char of normalizedPrefix) {
      if (!node.children.has(char)) {
        return new Set(); // Prefix not found
      }
      node = node.children.get(char);
    }

    return node.itemIndices;
  }

  /**
   * Get autocomplete suggestions
   * @param {string} prefix - Prefix to autocomplete
   * @param {number} limit - Maximum suggestions to return
   * @returns {Array<{word: string, score: number, metadata: Object}>}
   */
  autocomplete(prefix, limit = 10) {
    if (!prefix || typeof prefix !== 'string') return [];

    const normalizedPrefix = prefix.toLowerCase().trim();
    if (normalizedPrefix.length === 0) return [];

    let node = this.root;

    // Navigate to prefix node
    for (const char of normalizedPrefix) {
      if (!node.children.has(char)) {
        return [];
      }
      node = node.children.get(char);
    }

    const results = [];
    this._collectWords(node, normalizedPrefix, results, limit);

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Helper: Collect all words from a node (DFS)
   * @private
   */
  _collectWords(node, currentWord, results, limit) {
    if (results.length >= limit) return;

    if (node.isEndOfWord) {
      results.push({
        word: currentWord,
        score: node.score,
        metadata: node.metadata
      });
    }

    for (const [char, childNode] of node.children) {
      this._collectWords(childNode, currentWord + char, results, limit);
    }
  }

  /**
   * Clear all data from the trie
   */
  clear() {
    this.root = new TrieNode();
  }

  /**
   * Get statistics about the trie
   * @returns {Object} Stats including node count, word count, etc.
   */
  getStats() {
    let nodeCount = 0;
    let wordCount = 0;
    let maxDepth = 0;

    const traverse = (node, depth) => {
      nodeCount++;
      maxDepth = Math.max(maxDepth, depth);
      if (node.isEndOfWord) wordCount++;

      for (const child of node.children.values()) {
        traverse(child, depth + 1);
      }
    };

    traverse(this.root, 0);

    return { nodeCount, wordCount, maxDepth };
  }
}

/**
 * TrieFilter - High-level filtering interface for collections
 *
 * Generic filter for any collection based on string fields
 */
class TrieFilter {
  /**
   * @param {Object} config - Configuration
   * @param {Array<Object|Function>} config.fields - Fields to index
   *   - Object: { path: 'field.path', score: 100, transform: fn }
   *   - Function: (item) => string or array of strings
   * @param {Function} config.tokenize - Custom tokenizer (default: split by whitespace)
   */
  constructor(config = {}) {
    this.fields = config.fields || [];
    this.tokenize = config.tokenize || this._defaultTokenize;
    this.trie = new Trie();
    this.items = [];
  }

  /**
   * Default tokenizer: split by whitespace and remove punctuation
   * @private
   */
  _defaultTokenize(text) {
    if (!text || typeof text !== 'string') return [];
    return text.toLowerCase()
      .split(/\s+/)
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(word => word.length > 0);
  }

  /**
   * Get nested property value using dot notation
   * @private
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Build trie index from items
   * @param {Array} items - Items to index
   * @returns {TrieFilter} this (for chaining)
   */
  buildIndex(items) {
    this.items = items;
    this.trie.clear();

    items.forEach((item, index) => {
      this.fields.forEach(field => {
        // Field is a function
        if (typeof field === 'function') {
          const values = field(item);
          const valueArray = Array.isArray(values) ? values : [values];

          valueArray.forEach(value => {
            if (value && typeof value === 'string') {
              const tokens = this.tokenize(value);
              tokens.forEach(token => {
                this.trie.insert(token, index, 50);
              });
            }
          });
          return;
        }

        // Field is an object with path and config
        const path = field.path || field;
        const score = field.score || 50;
        const transform = field.transform || (v => v);

        const value = this._getNestedValue(item, path);
        if (!value) return;

        const transformedValue = transform(value);
        const valueArray = Array.isArray(transformedValue)
          ? transformedValue
          : [transformedValue];

        valueArray.forEach(val => {
          if (val && typeof val === 'string') {
            const tokens = this.tokenize(val);
            tokens.forEach(token => {
              this.trie.insert(token, index, score, { field: path });
            });
          }
        });
      });
    });

    return this;
  }

  /**
   * Calculate match score for a query against a field value
   * @param {string} query - Full search query (normalized)
   * @param {string} queryWord - Individual query word (normalized)
   * @param {string} fieldValue - Field value (normalized)
   * @returns {number} Match score
   * @private
   */
  _calculateMatchScore(query, queryWord, fieldValue) {
    // Exact field match (highest priority)
    if (fieldValue === query) {
      return SCORE_EXACT_MATCH;
    }

    // Split field into words for word-level matching
    const fieldWords = fieldValue.split(/\s+/).map(w => w.replace(/[^\w]/g, ''));

    // Exact word match within field
    if (fieldWords.includes(queryWord)) {
      return SCORE_EXACT_WORD;
    }

    // Field starts with query
    if (fieldValue.startsWith(query)) {
      return SCORE_STARTS_WITH;
    }

    // Any word starts with query word
    if (fieldWords.some(word => word.startsWith(queryWord))) {
      return SCORE_WORD_STARTS;
    }

    // Field contains query as substring
    if (fieldValue.includes(query) || fieldValue.includes(queryWord)) {
      return SCORE_CONTAINS;
    }

    // Base trie prefix match
    return SCORE_PREFIX_MATCH;
  }

  /**
   * Filter items by query string
   * @param {string} query - Search query
   * @param {Object} options - Filter options
   * @param {boolean} options.rankResults - Sort by relevance (default: true)
   * @param {number} options.limit - Max results to return
   * @param {boolean} options.includeSubstringMatches - Include items containing query as substring (default: true)
   * @returns {Array} Filtered items
   */
  filter(query, options = {}) {
    const { rankResults = true, limit = Infinity, includeSubstringMatches = true } = options;

    if (!query || query.trim().length === 0) {
      return limit === Infinity ? this.items : this.items.slice(0, limit);
    }

    const normalizedQuery = query.toLowerCase().trim();
    const queryWords = this.tokenize(query);
    const itemScores = new Map();

    // Phase 1: Trie-based prefix matching (fast)
    queryWords.forEach(queryWord => {
      const matchingIndices = this.trie.search(queryWord);

      matchingIndices.forEach(index => {
        const currentScore = itemScores.get(index) || 0;
        let bestScore = SCORE_PREFIX_MATCH;

        // Check each field for best match quality
        // Field weight is used as a multiplier (normalized to 0.5-2.0 range)
        this.fields.forEach(field => {
          const path = typeof field === 'function' ? null : (field.path || field);
          if (!path) return;

          const fieldWeight = typeof field === 'object' ? (field.score || 50) : 50;
          // Normalize field weight: 50 = 1.0x, 100 = 1.5x, 200 = 2.0x
          const weightMultiplier = 0.5 + (fieldWeight / 100);

          const value = this._getNestedValue(this.items[index], path);
          if (!value || typeof value !== 'string') return;

          const normalizedValue = value.toLowerCase();
          const matchScore = this._calculateMatchScore(normalizedQuery, queryWord, normalizedValue);
          // Apply field weight as multiplier to match score
          const weightedScore = Math.round(matchScore * weightMultiplier);
          bestScore = Math.max(bestScore, weightedScore);
        });

        // Add score, boosting for multiple query word matches
        itemScores.set(index, currentScore + bestScore);
      });
    });

    // Phase 2: Substring matching for items not found by trie (catches partial matches)
    if (includeSubstringMatches && normalizedQuery.length >= 2) {
      this.items.forEach((item, index) => {
        // Skip if already found by trie
        if (itemScores.has(index)) return;

        let bestScore = 0;

        this.fields.forEach(field => {
          const path = typeof field === 'function' ? null : (field.path || field);
          if (!path) return;

          const fieldWeight = typeof field === 'object' ? (field.score || 50) : 50;
          const weightMultiplier = 0.5 + (fieldWeight / 100);

          const value = this._getNestedValue(item, path);
          if (!value || typeof value !== 'string') return;

          const normalizedValue = value.toLowerCase();

          // Check for substring match
          if (normalizedValue.includes(normalizedQuery)) {
            const weightedScore = Math.round(SCORE_CONTAINS * weightMultiplier);
            bestScore = Math.max(bestScore, weightedScore);
          }
        });

        if (bestScore > 0) {
          itemScores.set(index, bestScore);
        }
      });
    }

    // Phase 3: Build and sort results
    let results = Array.from(itemScores.entries())
      .map(([index, score]) => ({ item: this.items[index], score }));

    if (rankResults) {
      results.sort((a, b) => b.score - a.score);
    }

    results = results.slice(0, limit).map(({ item }) => item);

    return results;
  }

  /**
   * Filter items by query string, returning results with scores
   * @param {string} query - Search query
   * @param {Object} options - Filter options (same as filter())
   * @returns {Array<{item: Object, score: number}>} Filtered items with scores
   */
  filterWithScores(query, options = {}) {
    const { rankResults = true, limit = Infinity, includeSubstringMatches = true } = options;

    if (!query || query.trim().length === 0) {
      const items = limit === Infinity ? this.items : this.items.slice(0, limit);
      return items.map(item => ({ item, score: 0 }));
    }

    const normalizedQuery = query.toLowerCase().trim();
    const queryWords = this.tokenize(query);
    const itemScores = new Map();

    // Phase 1: Trie-based prefix matching (fast)
    queryWords.forEach(queryWord => {
      const matchingIndices = this.trie.search(queryWord);

      matchingIndices.forEach(index => {
        const currentScore = itemScores.get(index) || 0;
        let bestScore = SCORE_PREFIX_MATCH;

        // Check each field for best match quality
        // Field weight is used as a multiplier (normalized to 0.5-2.0 range)
        this.fields.forEach(field => {
          const path = typeof field === 'function' ? null : (field.path || field);
          if (!path) return;

          const fieldWeight = typeof field === 'object' ? (field.score || 50) : 50;
          // Normalize field weight: 50 = 1.0x, 100 = 1.5x, 200 = 2.0x
          const weightMultiplier = 0.5 + (fieldWeight / 100);

          const value = this._getNestedValue(this.items[index], path);
          if (!value || typeof value !== 'string') return;

          const normalizedValue = value.toLowerCase();
          const matchScore = this._calculateMatchScore(normalizedQuery, queryWord, normalizedValue);
          // Apply field weight as multiplier to match score
          const weightedScore = Math.round(matchScore * weightMultiplier);
          bestScore = Math.max(bestScore, weightedScore);
        });

        itemScores.set(index, currentScore + bestScore);
      });
    });

    // Phase 2: Substring matching
    if (includeSubstringMatches && normalizedQuery.length >= 2) {
      this.items.forEach((item, index) => {
        if (itemScores.has(index)) return;

        let bestScore = 0;

        this.fields.forEach(field => {
          const path = typeof field === 'function' ? null : (field.path || field);
          if (!path) return;

          const fieldWeight = typeof field === 'object' ? (field.score || 50) : 50;
          const weightMultiplier = 0.5 + (fieldWeight / 100);

          const value = this._getNestedValue(item, path);
          if (!value || typeof value !== 'string') return;

          const normalizedValue = value.toLowerCase();
          if (normalizedValue.includes(normalizedQuery)) {
            const weightedScore = Math.round(SCORE_CONTAINS * weightMultiplier);
            bestScore = Math.max(bestScore, weightedScore);
          }
        });

        if (bestScore > 0) {
          itemScores.set(index, bestScore);
        }
      });
    }

    // Phase 3: Build and sort results
    let results = Array.from(itemScores.entries())
      .map(([index, score]) => ({ item: this.items[index], score }));

    if (rankResults) {
      results.sort((a, b) => b.score - a.score);
    }

    return results.slice(0, limit);
  }

  /**
   * Get autocomplete suggestions
   * @param {string} query - Current input
   * @param {number} limit - Max suggestions
   * @returns {Array<string>} Suggestions
   */
  getSuggestions(query, limit = 5) {
    if (!query || query.trim().length < 2) return [];

    const tokens = this.tokenize(query);
    const lastToken = tokens[tokens.length - 1] || query.toLowerCase().trim();

    return this.trie.autocomplete(lastToken, limit);
  }

  /**
   * Get statistics
   * @returns {Object} Filter stats
   */
  getStats() {
    return {
      itemCount: this.items.length,
      fieldCount: this.fields.length,
      ...this.trie.getStats()
    };
  }
}

/**
 * Create a TrieFilter with simple field configuration
 * @param {Array<string>} fieldPaths - Simple array of field paths
 * @returns {TrieFilter}
 */
export function createSimpleFilter(fieldPaths) {
  return new TrieFilter({
    fields: fieldPaths.map(path => ({ path, score: 50 }))
  });
}

/**
 * Create a TrieFilter with custom configuration
 * @param {Object} config - Configuration object
 * @returns {TrieFilter}
 */
export function createFilter(config) {
  return new TrieFilter(config);
}

// Export score constants for external use
export const SCORES = {
  EXACT_MATCH: SCORE_EXACT_MATCH,
  EXACT_WORD: SCORE_EXACT_WORD,
  STARTS_WITH: SCORE_STARTS_WITH,
  WORD_STARTS: SCORE_WORD_STARTS,
  CONTAINS: SCORE_CONTAINS,
  PREFIX_MATCH: SCORE_PREFIX_MATCH
};

export { Trie, TrieNode, TrieFilter };
export default TrieFilter;
