/**
 * Trie Data Structure for Fast Text Search
 * Provides O(m) prefix matching where m is the length of the search query
 */

class TrieNode {
  constructor() {
    this.children = new Map();
    this.isEndOfWord = false;
    this.noteIndices = new Set(); // Store indices of notes containing this word
    this.score = 0; // For ranking
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  /**
   * Insert a word into the trie with associated note index
   * @param {string} word - Word to insert
   * @param {number} noteIndex - Index of the note in the array
   * @param {number} score - Score for this word (based on field importance)
   */
  insert(word, noteIndex, score = 1) {
    if (!word || typeof word !== 'string') return;

    const normalizedWord = word.toLowerCase().trim();
    if (normalizedWord.length === 0) return;

    let node = this.root;

    for (const char of normalizedWord) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char);
      node.noteIndices.add(noteIndex);
    }

    node.isEndOfWord = true;
    node.score = Math.max(node.score, score);
  }

  /**
   * Search for a prefix in the trie
   * @param {string} prefix - Prefix to search for
   * @returns {Set<number>} Set of note indices matching the prefix
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

    return node.noteIndices;
  }

  /**
   * Get all words starting with prefix (autocomplete)
   * @param {string} prefix - Prefix to search for
   * @param {number} limit - Maximum number of suggestions
   * @returns {Array<{word: string, score: number}>} Array of word suggestions with scores
   */
  autocomplete(prefix, limit = 10) {
    if (!prefix || typeof prefix !== 'string') return [];

    const normalizedPrefix = prefix.toLowerCase().trim();
    if (normalizedPrefix.length === 0) return [];

    let node = this.root;

    // Navigate to the prefix node
    for (const char of normalizedPrefix) {
      if (!node.children.has(char)) {
        return []; // Prefix not found
      }
      node = node.children.get(char);
    }

    const results = [];
    this._collectWords(node, normalizedPrefix, results, limit);

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Helper method to collect all words from a node
   * @private
   */
  _collectWords(node, currentWord, results, limit) {
    if (results.length >= limit) return;

    if (node.isEndOfWord) {
      results.push({ word: currentWord, score: node.score });
    }

    for (const [char, childNode] of node.children) {
      this._collectWords(childNode, currentWord + char, results, limit);
    }
  }
}

/**
 * Build a trie index from notes for fast searching
 * @param {Array} notes - Array of note objects
 * @returns {Trie} Populated trie structure
 */
export function buildNotesTrie(notes) {
  const trie = new Trie();

  notes.forEach((note, index) => {
    // Index content with high priority
    if (note.content) {
      const words = note.content.toLowerCase().split(/\s+/);
      words.forEach(word => {
        // Clean word (remove punctuation)
        const cleanWord = word.replace(/[^\w]/g, '');
        if (cleanWord.length > 0) {
          trie.insert(cleanWord, index, 100); // Content words get high score
        }
      });
    }

    // Index author name with medium priority
    if (note.user?.name) {
      const authorWords = note.user.name.toLowerCase().split(/\s+/);
      authorWords.forEach(word => {
        trie.insert(word, index, 50); // Author words get medium score
      });
    }

    // Index timestamp (date parts)
    if (note.createdAt) {
      const date = new Date(note.createdAt);
      const dateParts = [
        date.toLocaleDateString().split('/').join(' '), // "11/23/2025" -> "11 23 2025"
        date.toLocaleString('en-US', { month: 'short' }), // "Nov"
        date.toLocaleString('en-US', { month: 'long' }), // "November"
        date.getFullYear().toString() // "2025"
      ];

      dateParts.forEach(part => {
        if (part) {
          part.split(/\s+/).forEach(word => {
            trie.insert(word, index, 20); // Date parts get lower score
          });
        }
      });
    }
  });

  return trie;
}

/**
 * Search notes using Trie with ranking
 * @param {Array} notes - Array of note objects
 * @param {string} query - Search query
 * @param {Trie} trie - Pre-built trie index (optional, will build if not provided)
 * @returns {Array} Filtered and ranked notes
 */
export function searchNotesWithTrie(notes, query, trie = null) {
  if (!query || query.trim().length === 0) {
    return notes;
  }

  // Build trie if not provided
  const searchTrie = trie || buildNotesTrie(notes);

  const queryWords = query.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
  const noteScores = new Map();

  queryWords.forEach(queryWord => {
    // Clean query word
    const cleanQuery = queryWord.replace(/[^\w]/g, '');
    if (cleanQuery.length === 0) return;

    // Get matching note indices from trie
    const matchingIndices = searchTrie.search(cleanQuery);

    matchingIndices.forEach(index => {
      const currentScore = noteScores.get(index) || 0;

      // Calculate score based on match quality
      const note = notes[index];
      let scoreIncrement = 10; // Base score

      // Exact word match (word boundary)
      const content = (note.content || '').toLowerCase();
      const wordRegex = new RegExp(`\\b${cleanQuery}\\b`, 'i');
      if (wordRegex.test(content)) {
        scoreIncrement = 50;
      }

      // Starts with query (high relevance)
      if (content.startsWith(cleanQuery)) {
        scoreIncrement = 80;
      }

      // Exact phrase match (highest relevance)
      if (content.includes(query.toLowerCase())) {
        scoreIncrement = 100;
      }

      // Recency bias - boost recent notes
      if (note.createdAt) {
        const daysSinceCreated = (Date.now() - new Date(note.createdAt)) / (1000 * 60 * 60 * 24);
        if (daysSinceCreated < 7) {
          scoreIncrement += 5;
        }
      }

      noteScores.set(index, currentScore + scoreIncrement);
    });
  });

  // Filter and sort notes by score
  const scoredNotes = Array.from(noteScores.entries())
    .map(([index, score]) => ({ note: notes[index], score }))
    .sort((a, b) => b.score - a.score);

  return scoredNotes.map(({ note }) => note);
}

export { Trie, TrieNode };
