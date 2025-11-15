// Central event-bus utilities: storage bridge and broadcast helper
// This module initializes a storage listener that re-dispatches events
// broadcast via localStorage from other tabs into the current window as
// CustomEvents. It also exports a helper to broadcast events from this tab.

export function broadcastEvent(eventName, detail) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const payload = { event: eventName, detail, ts: Date.now() };
    try {
      // Use a general key for cross-tab events
      localStorage.setItem('bien:event', JSON.stringify(payload));
    } catch (e) {
      // ignore storage quota errors
    }
  } catch (e) {
    // ignore
  }
}

// Initialize storage listener to re-dispatch events from other tabs.
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('storage', (e) => {
    try {
      if (!e || !e.key) return;
      if (e.key !== 'bien:event' && e.key !== 'bien:plan_event') return;
      const raw = e.newValue;
      if (!raw) return;
      let payload = null;
      try {
        payload = JSON.parse(raw);
      } catch (err) {
        return;
      }
      if (!payload || !payload.event) return;
      try {
        window.dispatchEvent(new CustomEvent(payload.event, { detail: payload.detail }));
      } catch (err) {
        // ignore dispatch errors
      }
    } catch (err) {
      // ignore listener errors
    }
  });
}

export default {
  broadcastEvent,
};
