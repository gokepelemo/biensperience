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
 */

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
   * Filter items by query string
   * @param {string} query - Search query
   * @param {Object} options - Filter options
   * @param {boolean} options.rankResults - Sort by relevance (default: true)
   * @param {number} options.limit - Max results to return
   * @returns {Array} Filtered items
   */
  filter(query, options = {}) {
    const { rankResults = true, limit = Infinity } = options;

    if (!query || query.trim().length === 0) {
      return limit === Infinity ? this.items : this.items.slice(0, limit);
    }

    const queryWords = this.tokenize(query);
    const itemScores = new Map();

    queryWords.forEach(queryWord => {
      const matchingIndices = this.trie.search(queryWord);

      matchingIndices.forEach(index => {
        const currentScore = itemScores.get(index) || 0;

        // Calculate score based on match quality
        let scoreIncrement = 10; // Base score

        // Check each field for better match quality
        this.fields.forEach(field => {
          const path = typeof field === 'function' ? null : (field.path || field);
          if (!path) return;

          const value = this._getNestedValue(this.items[index], path);
          if (!value || typeof value !== 'string') return;

          const normalizedValue = value.toLowerCase();

          // Exact phrase match (highest)
          if (normalizedValue.includes(query.toLowerCase())) {
            scoreIncrement = Math.max(scoreIncrement, 100);
          }
          // Starts with query (high)
          else if (normalizedValue.startsWith(queryWord)) {
            scoreIncrement = Math.max(scoreIncrement, 80);
          }
          // Word boundary match (medium)
          else if (new RegExp(`\\b${queryWord}`, 'i').test(normalizedValue)) {
            scoreIncrement = Math.max(scoreIncrement, 50);
          }
        });

        itemScores.set(index, currentScore + scoreIncrement);
      });
    });

    let results = Array.from(itemScores.entries())
      .map(([index, score]) => ({ item: this.items[index], score }));

    if (rankResults) {
      results.sort((a, b) => b.score - a.score);
    }

    results = results.slice(0, limit).map(({ item }) => item);

    return results;
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

export { Trie, TrieNode, TrieFilter };
export default TrieFilter;
