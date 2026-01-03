/**
 * PhotosTab Component
 * Photos tab content for PlanItemDetailsModal with PhotoCard on left and PhotoUpload on right
 * 
 * Architecture:
 * - Maintains its own local photo state that is SOURCE OF TRUTH while modal is open
 * - Only initializes from planItem when plan item ID changes (different item selected)
 * - Ignores external prop changes for the same plan item to prevent state resets
 * - Auto-saves to backend when photos change (debounced)
 * - Supports photo deletion for uploaders and super admins
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import PhotoCard from '../PhotoCard/PhotoCard';
import PhotoUpload from '../PhotoUpload/PhotoUpload';
import EmptyState from '../EmptyState/EmptyState';
import Loading from '../Loading/Loading';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import { updatePlanItem } from '../../utilities/plans-api';
import { getPhotosByIds, deletePhoto } from '../../utilities/photos-api';
import { isSuperAdmin } from '../../utilities/permissions';
import { logger } from '../../utilities/logger';
import { lang } from '../../lang.constants';
import styles from './PhotosTab.module.scss';

/**
 * Normalize a photo ID to string format
 */
const normalizeId = (id) => {
  if (!id) return null;
  if (typeof id === 'string') return id;
  if (typeof id === 'object' && id.$oid) return id.$oid;
  if (typeof id === 'object' && typeof id.toString === 'function') {
    const str = id.toString();
    if (/^[a-f\d]{24}$/i.test(str)) return str;
  }
  if (typeof id === 'object' && id._id) return normalizeId(id._id);
  return null;
};

export default function PhotosTab({
  planItem,
  plan,
  canEdit = false,
  currentUser
}) {
  // ============================================
  // STATE
  // ============================================
  
  // Photos state - this is the SOURCE OF TRUTH while component is mounted
  const [photos, setPhotos] = useState([]);           // Full photo objects with URLs
  const [photoIds, setPhotoIds] = useState([]);       // Just the IDs
  
  // UI state
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Delete confirmation state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  // Currently selected photo in PhotoCard (for delete functionality)
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // ============================================
  // REFS for tracking without causing re-renders
  // ============================================
  
  // Track which plan item we've loaded data for
  const loadedForPlanItemId = useRef(null);
  // Track what photo IDs we started with (to detect changes for auto-save)
  const savedPhotoIds = useRef('');
  // Prevent auto-save on initial load
  const isInitialized = useRef(false);
  // Prevent save during save
  const isSaving = useRef(false);

  // ============================================
  // DERIVED VALUES
  // ============================================
  
  const planItemIdStr = normalizeId(planItem?._id);
  const hasPhotos = photos.length > 0;

  // ============================================
  // INITIALIZATION - Only when plan item changes
  // ============================================
  
  useEffect(() => {
    // Skip if no plan item
    if (!planItem || !planItemIdStr) return;

    // Skip if we've already loaded for this plan item
    // This is the KEY guard that prevents resets when props update
    if (loadedForPlanItemId.current === planItemIdStr) {
      return;
    }

    logger.info('[PhotosTab] Loading photos for plan item', { planItemIdStr });

    // Mark that we're loading for this plan item
    loadedForPlanItemId.current = planItemIdStr;
    isInitialized.current = false;

    // Get photos from planItem
    const rawPhotos = planItem.photos || planItem.details?.photos || [];
    const photoArray = Array.isArray(rawPhotos) ? rawPhotos : [];

    logger.debug('[PhotosTab] Raw photos from planItem', {
      rawPhotosLength: rawPhotos?.length,
      rawPhotosType: typeof rawPhotos,
      firstPhoto: photoArray[0],
      firstPhotoType: typeof photoArray[0]
    });

    // Extract IDs - could be ObjectIds, strings, or populated objects
    const ids = photoArray.map(p => {
      // String ID (most common case from JSON serialization)
      if (typeof p === 'string') return p;
      // Populated photo object with _id
      if (typeof p === 'object' && p?._id) return normalizeId(p._id);
      // Raw ObjectId-like object
      if (typeof p === 'object') return normalizeId(p);
      return null;
    }).filter(Boolean);

    logger.debug('[PhotosTab] Extracted photo IDs', { ids });

    if (ids.length > 0) {
      setLoading(true);
      setError(null);
      
      // ALWAYS fetch via API to ensure we get permissions for delete capability
      logger.info('[PhotosTab] Fetching photos by IDs (including permissions)', { ids });

      getPhotosByIds(ids)
        .then((fetchedPhotos) => {
          logger.info('[PhotosTab] Fetched photos with permissions', { 
            count: fetchedPhotos.length,
            hasPermissions: fetchedPhotos.some(p => p.permissions?.length > 0)
          });
          setPhotos(fetchedPhotos);
          setPhotoIds(ids);
          savedPhotoIds.current = ids.join(',');
          isInitialized.current = true;
        })
        .catch((err) => {
          logger.error('[PhotosTab] Failed to fetch photos', { error: err.message });
          setError('Failed to load photos');
          // Fallback: use populated photos if available (they just won't have delete capability)
          const hasPopulatedPhotos = photoArray.length > 0 &&
            typeof photoArray[0] === 'object' && photoArray[0]?.url;
          if (hasPopulatedPhotos) {
            setPhotos(photoArray);
            setPhotoIds(ids);
          } else {
            setPhotos([]);
            setPhotoIds([]);
          }
          isInitialized.current = true;
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      // No photos
      logger.debug('[PhotosTab] No photos for this plan item');
      setPhotos([]);
      setPhotoIds([]);
      savedPhotoIds.current = '';
      isInitialized.current = true;
    }
  }, [planItemIdStr]); // ONLY depend on plan item ID

  // ============================================
  // PHOTO UPLOAD HANDLER
  // ============================================
  
  /**
   * Handle data changes from PhotoUpload component
   * PhotoUpload uses functional updates, so we need to handle both patterns
   * 
   * Note: We avoid nested setState by computing both new photos and IDs together,
   * then setting them in separate (non-nested) calls.
   */
  const handlePhotoDataChange = useCallback((dataOrUpdater) => {
    if (typeof dataOrUpdater === 'function') {
      // Functional update from PhotoUpload
      // Compute new state based on current state via refs to avoid nested setState
      setPhotos(prevPhotos => {
        // Compute the new data using functional updater
        const prevData = { photos: photoIds, photos_full: prevPhotos };
        const newData = dataOrUpdater(prevData);
        
        // Extract new IDs
        const newIds = (newData.photos || []).map(id => 
          typeof id === 'object' ? normalizeId(id._id || id) : normalizeId(id)
        ).filter(Boolean);
        
        logger.debug('[PhotosTab] Photos updated (functional)', {
          prevCount: prevPhotos.length,
          newCount: newData.photos_full?.length || 0
        });
        
        // Schedule photoIds update outside of this setState
        // Using setTimeout(0) to avoid nested setState anti-pattern
        setTimeout(() => setPhotoIds(newIds), 0);
        
        return newData.photos_full || [];
      });
    } else {
      // Direct update
      logger.debug('[PhotosTab] Photos updated (direct)', {
        count: dataOrUpdater.photos_full?.length || 0
      });
      
      const newPhotos = dataOrUpdater.photos_full || [];
      const newIds = (dataOrUpdater.photos || []).map(id => 
        typeof id === 'object' ? normalizeId(id._id || id) : normalizeId(id)
      ).filter(Boolean);
      
      setPhotos(newPhotos);
      setPhotoIds(newIds);
    }
  }, [photoIds]);

  // ============================================
  // AUTO-SAVE
  // ============================================
  
  useEffect(() => {
    // Guards
    if (!isInitialized.current) return;
    if (!plan?._id || !planItem?._id || !canEdit) return;
    if (isSaving.current) return;

    const currentIds = photoIds.join(',');
    
    // Skip if no change
    if (currentIds === savedPhotoIds.current) return;

    logger.debug('[PhotosTab] Photo IDs changed, scheduling save', {
      from: savedPhotoIds.current,
      to: currentIds
    });

    // Debounced save
    const saveTimeout = setTimeout(async () => {
      if (isSaving.current) return;
      isSaving.current = true;
      setSaving(true);
      setError(null);

      try {
        await updatePlanItem(plan._id, planItem._id, { photos: photoIds });
        
        logger.info('[PhotosTab] Photos saved', {
          planId: plan._id,
          itemId: planItem._id,
          count: photoIds.length
        });

        // Update saved state
        savedPhotoIds.current = currentIds;
        
        // NOTE: We do NOT broadcast an event here because updatePlanItem already does
        
      } catch (err) {
        logger.error('[PhotosTab] Save failed', { error: err.message });
        setError(err.message || 'Failed to save photos');
      } finally {
        setSaving(false);
        isSaving.current = false;
      }
    }, 500);

    return () => clearTimeout(saveTimeout);
  }, [photoIds, plan?._id, planItem?._id, canEdit]);

  // ============================================
  // DELETE PHOTO HANDLERS
  // ============================================

  /**
   * Check if user can delete a specific photo
   * Returns true if user is the photo owner (uploader) OR is a super admin
   */
  const canDeletePhoto = useCallback((photo) => {
    if (!currentUser || !photo) {
      logger.debug('[PhotosTab] canDeletePhoto: no user or photo', { 
        hasUser: !!currentUser, 
        hasPhoto: !!photo 
      });
      return false;
    }
    
    // Super admin can delete any photo
    const isAdmin = isSuperAdmin(currentUser);
    logger.debug('[PhotosTab] canDeletePhoto check', { 
      photoId: photo._id,
      userId: currentUser._id,
      userRole: currentUser.role,
      isAdmin,
      photoPermissions: photo.permissions
    });
    
    if (isAdmin) return true;
    
    // Check if user is the owner in permissions array
    const userId = currentUser._id?.toString() || currentUser._id;
    const isOwner = photo.permissions?.some(p => 
      p.entity === 'user' && 
      p.type === 'owner' && 
      (p._id?.toString() || p._id) === userId
    );
    
    return isOwner;
  }, [currentUser]);

  /**
   * Handle photo selection change from PhotoCard
   */
  const handlePhotoChange = useCallback((photo) => {
    setSelectedPhoto(photo);
  }, []);

  /**
   * Open delete confirmation modal
   */
  const handleDeleteClick = useCallback((photo) => {
    setPhotoToDelete(photo);
    setShowDeleteModal(true);
  }, []);

  /**
   * Cancel delete
   */
  const handleCancelDelete = useCallback(() => {
    setShowDeleteModal(false);
    setPhotoToDelete(null);
  }, []);

  /**
   * Confirm and execute photo deletion
   */
  const handleConfirmDelete = useCallback(async () => {
    if (!photoToDelete || !plan?._id || !planItem?._id) return;
    
    const photoId = normalizeId(photoToDelete._id);
    if (!photoId) return;
    
    setDeleting(true);
    setError(null);
    
    try {
      // 1. Delete the photo from the database
      await deletePhoto(photoId);
      
      logger.info('[PhotosTab] Photo deleted', { photoId });
      
      // 2. Remove from local state
      setPhotos(prev => prev.filter(p => normalizeId(p._id) !== photoId));
      setPhotoIds(prev => prev.filter(id => id !== photoId));
      
      // 3. Close modal
      setShowDeleteModal(false);
      setPhotoToDelete(null);
      
      // Note: Auto-save effect will handle updating the plan item
      
    } catch (err) {
      logger.error('[PhotosTab] Failed to delete photo', { error: err.message });
      setError(err.message || 'Failed to delete photo');
    } finally {
      setDeleting(false);
    }
  }, [photoToDelete, plan?._id, planItem?._id]);

  // ============================================
  // DATA FOR PhotoUpload COMPONENT
  // ============================================
  
  // PhotoUpload expects data in a specific format
  const photoUploadData = {
    photos: photoIds,
    photos_full: photos,
    default_photo_id: photos[0]?._id || null
  };

  // ============================================
  // RENDER
  // ============================================
  
  // Get language strings for delete modal
  const t = lang.current;
  const deleteModalTitle = t.photo?.deletePhotoTitle || 'Delete Photo?';
  const deleteModalMessage = t.photo?.deletePhotoMessage || 'You are about to permanently delete this photo';
  const deleteModalConfirm = t.photo?.deletePhotoConfirm || 'Delete Permanently';
  
  return (
    <div className={styles.photosTab}>
      {error && (
        <div className={styles.errorMessage}>{error}</div>
      )}

      <div className={styles.photosContainer}>
        {/* Left side: PhotoCard display */}
        <div className={styles.photoCardSection}>
          <h4 className={styles.sectionTitle}>
            {lang.current.planItemDetailsModal?.currentPhotos || 'Current Photos'}
          </h4>
          {loading ? (
            <Loading size="sm" message="Loading photos..." />
          ) : hasPhotos ? (
            <PhotoCard
              photos={photos}
              altText={planItem?.text || 'Plan item photo'}
              title={planItem?.text || 'Plan Item'}
              onPhotoChange={handlePhotoChange}
            />
          ) : (
            <EmptyState
              variant="photos"
              size="md"
              fillContainer
            />
          )}
        </div>

        {/* Right side: PhotoUpload */}
        {canEdit && (
          <div className={styles.photoUploadSection}>
            <div className={styles.sectionHeader}>
              <h4 className={styles.sectionTitle}>
                {lang.current.planItemDetailsModal?.managePhotos || 'Manage Photos'}
              </h4>
              {saving && (
                <Loading size="xs" showMessage={false} />
              )}
            </div>
            <div className={styles.photoUploadWrapper}>
              <PhotoUpload
                data={photoUploadData}
                setData={handlePhotoDataChange}
                hideUploadedPhotos={true}
                maxHeight="400px"
              />
            </div>
            
            {/* Delete button for currently selected photo */}
            {hasPhotos && selectedPhoto && canDeletePhoto(selectedPhoto) && (
              <div className={styles.photoDeleteActions}>
                <button
                  type="button"
                  className={`btn btn-outline-danger btn-sm ${styles.deletePhotoButton}`}
                  onClick={() => handleDeleteClick(selectedPhoto)}
                >
                  {t.photo?.deletePhoto || 'Delete'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Read-only message */}
        {!canEdit && !hasPhotos && (
          <div className={styles.readOnlyMessage}>
            {lang.current.planItemDetailsModal?.noPhotosReadOnly || 'No photos have been added to this item.'}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        show={showDeleteModal}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title={deleteModalTitle}
        message={deleteModalMessage}
        itemName={photoToDelete?.caption || 'this photo'}
        confirmText={deleting ? (t.button?.deleting || 'Deleting...') : deleteModalConfirm}
        confirmVariant="danger"
        cancelText={t.button?.cancel || 'Cancel'}
        confirmDisabled={deleting}
      />
    </div>
  );
}
