/**
 * UploadProgressContext
 *
 * Global upload progress tracker. API utilities emit events via the event bus;
 * this context aggregates them so any component (e.g. the NavBar indicator)
 * can display real-time upload status without prop drilling.
 *
 * Events consumed (via eventBus):
 *   upload:started   → { uploadId, fileName, fileSize, type: 'photo'|'document' }
 *   upload:progress  → { uploadId, loaded, total, percent }
 *   upload:completed → { uploadId }
 *   upload:failed    → { uploadId, error }
 */

import { createContext, useContext, useCallback, useEffect, useRef } from 'react';
import { useSyncExternalStore } from 'react';
import { eventBus } from '../utilities/event-bus';
import { logger } from '../utilities/logger';

// ── External store (avoids re-creating state on every render) ──

let uploads = new Map();       // uploadId → { fileName, fileSize, type, loaded, total, percent, status }
let listeners = new Set();

function emitChange() {
  listeners.forEach(fn => fn());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return uploads;
}

function addUpload(id, info) {
  uploads = new Map(uploads);
  uploads.set(id, { ...info, loaded: 0, total: info.fileSize || 0, percent: 0, status: 'uploading' });
  emitChange();
}

function updateUpload(id, progress) {
  if (!uploads.has(id)) return;
  uploads = new Map(uploads);
  uploads.set(id, { ...uploads.get(id), ...progress });
  emitChange();
}

function completeUpload(id) {
  if (!uploads.has(id)) return;
  uploads = new Map(uploads);
  uploads.delete(id);
  emitChange();
}

function failUpload(id) {
  if (!uploads.has(id)) return;
  uploads = new Map(uploads);
  const entry = uploads.get(id);
  uploads.set(id, { ...entry, status: 'failed' });
  emitChange();
  // Auto-remove failed uploads after 4 seconds
  setTimeout(() => {
    if (uploads.has(id) && uploads.get(id).status === 'failed') {
      completeUpload(id);
    }
  }, 4000);
}

// ── Context ──

const UploadProgressContext = createContext(null);

export function UploadProgressProvider({ children }) {
  const store = useSyncExternalStore(subscribe, getSnapshot);

  // Subscribe to event bus upload events
  useEffect(() => {
    const unsubs = [
      eventBus.subscribe('upload:started', (e) => {
        logger.debug('[UploadProgress] Upload started', { id: e.uploadId, name: e.fileName });
        addUpload(e.uploadId, { fileName: e.fileName, fileSize: e.fileSize, type: e.type });
      }),
      eventBus.subscribe('upload:progress', (e) => {
        updateUpload(e.uploadId, { loaded: e.loaded, total: e.total, percent: e.percent });
      }),
      eventBus.subscribe('upload:completed', (e) => {
        logger.debug('[UploadProgress] Upload completed', { id: e.uploadId });
        completeUpload(e.uploadId);
      }),
      eventBus.subscribe('upload:failed', (e) => {
        logger.debug('[UploadProgress] Upload failed', { id: e.uploadId, error: e.error });
        failUpload(e.uploadId);
      }),
    ];
    return () => unsubs.forEach(fn => fn());
  }, []);

  return (
    <UploadProgressContext.Provider value={store}>
      {children}
    </UploadProgressContext.Provider>
  );
}

/**
 * Hook to access the current uploads map.
 * Returns { uploads: Map, activeCount, aggregatePercent, hasUploads }
 */
export function useUploadProgress() {
  const store = useContext(UploadProgressContext);
  // Allow usage outside provider (returns empty state)
  const map = store || new Map();

  const activeUploads = [];
  let totalLoaded = 0;
  let totalSize = 0;
  let hasFailed = false;

  map.forEach((entry) => {
    activeUploads.push(entry);
    if (entry.status === 'uploading') {
      totalLoaded += entry.loaded || 0;
      totalSize += entry.total || 0;
    }
    if (entry.status === 'failed') hasFailed = true;
  });

  const aggregatePercent = totalSize > 0 ? Math.round((totalLoaded / totalSize) * 100) : 0;

  return {
    uploads: activeUploads,
    activeCount: activeUploads.filter(u => u.status === 'uploading').length,
    aggregatePercent,
    hasUploads: activeUploads.length > 0,
    hasFailed,
  };
}
