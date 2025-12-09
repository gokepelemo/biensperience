/**
 * Paquette Utils - Easter Egg Utility
 * Named after the whimsical nature of hidden surprises
 * 
 * Intermittently adds Easter egg phrases to text content throughout the application.
 * Breaks paragraphs into phrases and randomly inserts Easter eggs at natural break points.
 * 
 * @module paquette-utils
 */

import { logger } from './logger';

/**
 * Easter egg phrases/paragraphs to be intermittently added to content
 * @type {Object.<string, Array<string>>}
 */
const EASTER_EGGS = {
  tagline: [
    'Explore, dream, discover.',
  ],
  inspirational: [
    'The journey of a thousand miles begins with a single step.',
    'Not all those who wander are lost.',
    'Adventure awaits.',
    'Life is either a daring adventure or nothing at all.',
  ],
  subtle: [
    'What will you discover next?',
    'Your adventure begins here.',
    'Every destination tells a story.',
  ]
};

/**
 * Configuration for Easter egg injection
 * @typedef {Object} PaquetteConfig
 * @property {number} probability - Base probability (0-1) of showing an Easter egg
 * @property {string} category - Category of Easter eggs to use ('tagline', 'inspirational', 'subtle', 'all')
 * @property {boolean} respectSentences - Only add at sentence boundaries (after . ! ?)
 * @property {boolean} asNewSentence - Add as a separate sentence (with capitalization)
 * @property {number} minTextLength - Minimum text length before considering Easter egg injection
 * @property {number} seed - Deterministic seed for consistent behavior (null = random)
 */

/**
 * Default configuration
 * @type {PaquetteConfig}
 */
const DEFAULT_CONFIG = {
  probability: 0.25, // 25% chance
  category: 'tagline',
  respectSentences: true,
  asNewSentence: false,
  minTextLength: 20,
  seed: null,
};

/**
 * Seeded pseudo-random number generator for consistent behavior
 * Uses a simple LCG (Linear Congruential Generator)
 * @param {number} seed - Seed value
 * @returns {Function} Random number generator (0-1)
 */
function createSeededRandom(seed) {
  let state = seed;
  return function() {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Get a random Easter egg from the specified category
 * @param {string} category - Category name or 'all'
 * @param {Function} random - Random number generator
 * @returns {string|null} Random Easter egg or null
 */
function getRandomEasterEgg(category, random) {
  let pool = [];
  
  if (category === 'all') {
    pool = Object.values(EASTER_EGGS).flat();
  } else if (EASTER_EGGS[category]) {
    pool = EASTER_EGGS[category];
  } else {
    logger.warn('[paquette-utils] Unknown Easter egg category', { category });
    return null;
  }
  
  if (pool.length === 0) return null;
  
  const index = Math.floor(random() * pool.length);
  return pool[index];
}

/**
 * Split text into sentences (respecting common abbreviations)
 * @param {string} text - Text to split
 * @returns {Array<string>} Array of sentences
 */
function splitIntoSentences(text) {
  // Match sentence boundaries (. ! ?) not preceded by common abbreviations
  const sentenceRegex = /(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|e\.g|i\.e))[.!?]+\s+/g;
  return text.split(sentenceRegex).filter(s => s.trim().length > 0);
}

/**
 * Find natural break points in text (sentence endings, after commas, etc.)
 * @param {string} text - Text to analyze
 * @returns {Array<number>} Array of character indices where breaks occur
 */
function findBreakPoints(text) {
  const breakPoints = [];
  
  // Sentence endings
  const sentenceEndings = /[.!?]\s+/g;
  let match;
  while ((match = sentenceEndings.exec(text)) !== null) {
    breakPoints.push(match.index + match[0].length);
  }
  
  // After commas (if no sentence breaks found)
  if (breakPoints.length === 0) {
    const commas = /,\s+/g;
    while ((match = commas.exec(text)) !== null) {
      breakPoints.push(match.index + match[0].length);
    }
  }
  
  return breakPoints;
}

/**
 * Intermittently add an Easter egg phrase to text content
 * 
 * @param {string} text - Original text content
 * @param {Partial<PaquetteConfig>} config - Configuration overrides
 * @returns {string} Text with Easter egg possibly added
 * 
 * @example
 * // Simple usage
 * addEasterEgg('Browse amazing destinations.')
 * // => 'Browse amazing destinations. Explore, dream, discover.'
 * 
 * @example
 * // With custom probability and category
 * addEasterEgg('Your plans await.', { probability: 0.5, category: 'inspirational' })
 * // => 'Your plans await. Adventure awaits.' (50% chance)
 * 
 * @example
 * // With seed for deterministic behavior (testing)
 * addEasterEgg('Search results.', { seed: 12345 })
 * // => Always returns same result with same seed
 */
export function addEasterEgg(text, config = {}) {
  if (!text || typeof text !== 'string') return text;
  
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Skip if text too short
  if (text.length < cfg.minTextLength) return text;
  
  // Create random number generator (seeded or not)
  const random = cfg.seed !== null ? createSeededRandom(cfg.seed) : Math.random;
  
  // Roll the dice
  if (random() > cfg.probability) return text;
  
  // Get an Easter egg
  const easterEgg = getRandomEasterEgg(cfg.category, random);
  if (!easterEgg) return text;
  
  // Find where to insert
  if (cfg.respectSentences) {
    const breakPoints = findBreakPoints(text);
    
    if (breakPoints.length > 0) {
      // Insert at a random break point (prefer later in text)
      const insertIndex = breakPoints[Math.floor(random() * breakPoints.length)];
      
      let prefix = text.substring(0, insertIndex).trim();
      let suffix = text.substring(insertIndex).trim();
      
      // Add appropriate spacing
      if (cfg.asNewSentence) {
        // Capitalize first letter
        const capitalizedEgg = easterEgg.charAt(0).toUpperCase() + easterEgg.slice(1);
        return `${prefix} ${capitalizedEgg}${suffix ? ' ' + suffix : ''}`;
      } else {
        return `${prefix} ${easterEgg}${suffix ? ' ' + suffix : ''}`;
      }
    }
  }
  
  // Fallback: append to end
  const needsSpace = !/[.!?]\s*$/.test(text);
  const separator = needsSpace ? ' ' : ' ';
  
  if (cfg.asNewSentence) {
    const capitalizedEgg = easterEgg.charAt(0).toUpperCase() + easterEgg.slice(1);
    return text + separator + capitalizedEgg;
  }
  
  return text + separator + easterEgg;
}

/**
 * Break a paragraph into phrases and intermittently add Easter eggs
 * More sophisticated than addEasterEgg - breaks text at natural points
 * 
 * @param {string} paragraph - Paragraph text
 * @param {Partial<PaquetteConfig>} config - Configuration overrides
 * @returns {string} Paragraph with Easter eggs possibly added at phrase boundaries
 * 
 * @example
 * addEasterEggToParagraph(
 *   'Start planning your adventure. Browse destinations. Create your plan.',
 *   { probability: 0.3 }
 * )
 * // => 'Start planning your adventure. Explore, dream, discover. Browse destinations. Create your plan.'
 */
export function addEasterEggToParagraph(paragraph, config = {}) {
  if (!paragraph || typeof paragraph !== 'string') return paragraph;
  
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Skip if text too short
  if (paragraph.length < cfg.minTextLength) return paragraph;
  
  // Split into sentences
  const sentences = splitIntoSentences(paragraph);
  if (sentences.length === 0) return paragraph;
  
  // Create random number generator
  const random = cfg.seed !== null ? createSeededRandom(cfg.seed) : Math.random;
  
  // Decide if we're adding an Easter egg
  if (random() > cfg.probability) return paragraph;
  
  // Get an Easter egg
  const easterEgg = getRandomEasterEgg(cfg.category, random);
  if (!easterEgg) return paragraph;
  
  // Choose a random sentence position (prefer middle to end)
  const insertPosition = Math.floor(random() * sentences.length);
  
  // Capitalize if needed
  const egg = cfg.asNewSentence 
    ? easterEgg.charAt(0).toUpperCase() + easterEgg.slice(1)
    : easterEgg;
  
  // Insert the Easter egg
  sentences.splice(insertPosition + 1, 0, egg);
  
  return sentences.join(' ');
}

/**
 * Add custom Easter egg to the collection
 * @param {string} category - Category name
 * @param {string} phrase - Easter egg phrase
 */
export function registerEasterEgg(category, phrase) {
  if (!EASTER_EGGS[category]) {
    EASTER_EGGS[category] = [];
  }
  if (!EASTER_EGGS[category].includes(phrase)) {
    EASTER_EGGS[category].push(phrase);
    logger.debug('[paquette-utils] Registered new Easter egg', { category, phrase });
  }
}

/**
 * Get all Easter eggs in a category (for testing/debugging)
 * @param {string} category - Category name or 'all'
 * @returns {Array<string>} Array of Easter eggs
 */
export function getEasterEggs(category = 'all') {
  if (category === 'all') {
    return Object.values(EASTER_EGGS).flat();
  }
  return EASTER_EGGS[category] || [];
}

/**
 * Clear all Easter eggs in a category (for testing)
 * @param {string} category - Category name
 */
export function clearEasterEggs(category) {
  if (EASTER_EGGS[category]) {
    EASTER_EGGS[category] = [];
  }
}
