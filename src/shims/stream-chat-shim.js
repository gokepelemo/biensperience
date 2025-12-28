// Shim for stream-chat to provide a fallback FixedSizeQueueCache export
// This helps when the installed `stream-chat` package does not export
// `FixedSizeQueueCache` expected by `stream-chat-react`.

// Import the real ESM build directly to avoid Vite alias recursion
import * as StreamChatModule from 'stream-chat/dist/browser.es.js';

// Minimal fallback implementation for FixedSizeQueueCache
class FixedSizeQueueCacheFallback {
  constructor(limit = 100) {
    this.limit = typeof limit === 'number' ? limit : 100;
    this._q = [];
  }

  push(item) {
    this._q.push(item);
    while (this._q.length > this.limit) this._q.shift();
  }

  toArray() {
    return this._q.slice();
  }

  clear() {
    this._q.length = 0;
  }

  get length() {
    return this._q.length;
  }
}

// Export everything from the real module, but ensure FixedSizeQueueCache exists
const FixedSizeQueueCache = StreamChatModule.FixedSizeQueueCache || FixedSizeQueueCacheFallback;

export * from 'stream-chat/dist/browser.es.js';
export { FixedSizeQueueCache };
export default StreamChatModule;
// Shim for stream-chat to provide a fallback FixedSizeQueueCache export
// This helps when the installed `stream-chat` package does not export
// `FixedSizeQueueCache` expected by `stream-chat-react`.

import * as StreamChatModule from 'stream-chat';

// Minimal fallback implementation for FixedSizeQueueCache
class FixedSizeQueueCacheFallback {
  constructor(limit = 100) {
    this.limit = typeof limit === 'number' ? limit : 100;
    this._q = [];
  }

  push(item) {
    this._q.push(item);
    while (this._q.length > this.limit) this._q.shift();
  }

  toArray() {
    return this._q.slice();
  }

  clear() {
    this._q.length = 0;
  }

  get length() {
    return this._q.length;
  }
}

// Export everything from the real module, but ensure FixedSizeQueueCache exists
const FixedSizeQueueCache = StreamChatModule.FixedSizeQueueCache || FixedSizeQueueCacheFallback;

export * from 'stream-chat';
export { FixedSizeQueueCache };
export default StreamChatModule;
