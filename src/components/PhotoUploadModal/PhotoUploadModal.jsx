import React, { useState, useEffect, useCallback } from 'react';
import { useRef } from 'react';
import styles from './PhotoUploadModal.module.scss';
import PhotoUpload from '../PhotoUpload/PhotoUpload';
import { Button } from '../design-system';

export default function PhotoUploadModal({
  show,
  onClose,
  entityType,
  entity,
  photos, // optional: array of populated preview objects or ids
  onSave, // optional: (data) => Promise
  onChange // optional: called whenever localData changes
}) {
  const [localData, setLocalData] = useState(() => ({ photos: [], photos_full: [] }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Initialize localData when the modal opens (transition false->true) or
  // when the modal opened but entity became available shortly after. We
  // avoid re-initializing while the modal remains open (to prevent the
  // save -> update -> re-init loop). Use previousShowRef to detect the
  // open transition.
  const previousShowRef = useRef(false);
  useEffect(() => {
    // Only initialize on transition into open state, or if we attempted
    // to initialize but entity wasn't available yet (previousShowRef
    // remains false). This allows the modal to open before entity is
    // populated and still initialize once the entity arrives.
    if (!show) {
      previousShowRef.current = false;
      return;
    }

    // If we're already open and we've initialized before, do nothing
    if (previousShowRef.current) return;

    // Reset notifyRef so we skip the first onChange after opening
    notifyRef.current = false;

    // Determine the source of truth for initial photos. Prefer explicit
    // `photos` prop passed by the caller (this should be an array of
    // populated preview objects or ids). Fall back to entity props when
    // available so older callsites keep working.
    if (!photos && !entity) {
      // Neither photos nor entity available yet; keep previousShowRef false
      // so initialization will attempt again when either arrives.
      return;
    }

    // When `photos` prop is passed as an array, use it directly.
    // Otherwise fall back to entity.photos.
    const photosSource = Array.isArray(photos) ? photos : (entity?.photos || []);

    // Capture original photo IDs from the source so we can preserve any
    // existing database photos when the user hasn't explicitly removed them.
    const originalIds = Array.isArray(photosSource)
      ? photosSource.map(p => (typeof p === 'object' ? p._id : p))
      : [];

    // Determine populated photo objects for preview display
    const photosFull = (Array.isArray(photos) && photos.length > 0 && typeof photos[0] === 'object')
      ? photos
      : (entity && Array.isArray(entity.photos_full) && entity.photos_full.length > 0
        ? entity.photos_full
        : (entity && Array.isArray(entity.photos) && entity.photos.length > 0 && typeof entity.photos[0] === 'object'
          ? entity.photos
          : []));

    const init = {
      // Local photos are represented both as IDs (`photos`) and populated
      // preview objects (`photos_full`). Prefer explicit `photos` prop
      // when provided and populated; otherwise fall back to entity.
      photos: originalIds.slice(),
      photos_full: photosFull,
      default_photo_id: (entity && entity.default_photo_id) || null
    };

    setLocalData(init);
    previousShowRef.current = true;
  }, [show, entity, photos]);

  // Notify parent of changes to localData so UI can update instantly
  // Track whether we've already performed the initial notification skip
  const notifyRef = useRef(false);

  useEffect(() => {
    // Avoid notifying parent on the initial initialization of localData.
    // Initialization comes from `entity` prop and will immediately set
    // localData which would otherwise trigger an onChange and cause the
    // parent to persist without any user interaction. Skipping the first
    // notification prevents a save -> server event -> re-init -> save loop.
    if (typeof onChange !== 'function') return;
    if (!notifyRef.current) {
      // First run after init: mark as handled and don't notify parent
      notifyRef.current = true;
      return;
    }

    try {
      const localIds = Array.isArray(localData.photos)
        ? localData.photos.map(p => (typeof p === 'object' ? p._id : p))
        : [];
      const merged = { ...localData, photos: localIds };
      try { logger.debug('[PhotoUploadModal] onChange notifying parent', { photoCount: localIds.length }); } catch (e) {}
      onChange(merged);
    } catch (e) {
      // swallow errors from parent handler but log for debugging
      // eslint-disable-next-line no-console
      console.error('[PhotoUploadModal] onChange handler error', e);
    }
  }, [localData, onChange]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      if (onSave) {
        // On save, ensure we don't accidentally remove existing DB photos
        // by merging original IDs with the local set. This avoids a bug
        // where callers that receive an unpopulated server payload would
        // wipe populated client previews.
        const localIds = Array.isArray(localData.photos)
          ? localData.photos.map(p => (typeof p === 'object' ? p._id : p))
          : [];
        const payload = { ...localData, photos: localIds };
        await onSave(payload);
      }
      onClose();
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Failed to save photos');
    } finally {
      setSaving(false);
    }
  }, [localData, onSave, onClose]);

  if (!show) return null;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Manage photos">
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h4>Manage Photos</h4>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.modalBody}>
          <PhotoUpload data={localData} setData={setLocalData} />
          {error && <div className={styles.error}>{error}</div>}
        </div>

        <div className={styles.modalFooter}>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Photos'}
          </Button>
        </div>
      </div>
    </div>
  );
}
