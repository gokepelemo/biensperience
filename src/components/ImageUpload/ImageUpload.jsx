import { useState, useEffect, useRef } from "react";
import styles from "./ImageUpload.module.scss";
import { uploadPhoto, uploadPhotoBatch, uploadPhotoUrl, deletePhoto } from "../../utilities/photos-api";
import { handleError } from "../../utilities/error-handler";
import { createUrlSlug } from "../../utilities/url-utils";
import { getImageDimensionsSafe } from "../../utilities/image-utils";
import { lang } from "../../lang.constants";
import Alert from "../Alert/Alert";
import AlertModal from "../AlertModal/AlertModal";
import ConfirmModal from "../ConfirmModal/ConfirmModal";
import { logger } from "../../utilities/logger";
import { FormControl } from "../../components/design-system";

/**
 * Sanitizes text for safe display in JSX
 * React automatically escapes JSX text content, but we ensure the value is a string
 * @param {string} text - The text to sanitize
 * @returns {string} - The sanitized text (empty string if null/undefined)
 */
function sanitizeText(text) {
  // Return empty string for null/undefined, or convert to string and trim
  return text ? String(text).trim() : '';
}

/**
 * Validate that a URL is safe for use in img src attribute
 * Prevents XSS via javascript:, data:, or other dangerous protocols
 *
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL is safe
 */
function isSafeImageUrl(url) {
  if (!url || typeof url !== 'string') return false;

  // Only allow http:, https:, and relative URLs
  const trimmedUrl = url.trim().toLowerCase();
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://') || trimmedUrl.startsWith('/')) {
    return true;
  }

  // Block dangerous protocols
  if (trimmedUrl.startsWith('javascript:') ||
      trimmedUrl.startsWith('data:') ||
      trimmedUrl.startsWith('vbscript:')) {
    return false;
  }

  // Allow relative URLs without protocol
  if (!trimmedUrl.includes(':')) {
    return true;
  }

  return false;
}

export default function ImageUpload({ data, setData }) {
  const [uploadForm, setUploadForm] = useState({});
  const [uploading, setUploading] = useState(false);
  const [useUrl, setUseUrl] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertTitle, setAlertTitle] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [photoToDeleteIndex, setPhotoToDeleteIndex] = useState(null);

  const [urlQueue, setUrlQueue] = useState([]);
  const [editingUrlIndex, setEditingUrlIndex] = useState(null);

  const [photos, setPhotos] = useState(() => data.photos || []);
  const [defaultPhotoIndex, setDefaultPhotoIndex] = useState(() => {
    if (data.default_photo_id && data.photos) {
      const index = data.photos.findIndex(photo =>
        photo._id === data.default_photo_id || photo === data.default_photo_id
      );
      return index >= 0 ? index : 0;
    }
    return 0;
  });

  const [disabledPhotos, setDisabledPhotos] = useState(() => new Set());

  const prevPhotosRef = useRef();
  const prevDefaultIndexRef = useRef();

  useEffect(() => {
    const activePhotos = photos.filter((_, index) => !disabledPhotos.has(index));

    let adjustedDefaultIndex = defaultPhotoIndex;
    if (disabledPhotos.has(defaultPhotoIndex)) {
      adjustedDefaultIndex = photos.findIndex((_, idx) => !disabledPhotos.has(idx));
      if (adjustedDefaultIndex === -1) adjustedDefaultIndex = 0;
    } else {
      adjustedDefaultIndex = photos
        .slice(0, defaultPhotoIndex)
        .filter((_, idx) => !disabledPhotos.has(idx))
        .length;
    }

    const newDefaultIndex = activePhotos.length > 0 ? adjustedDefaultIndex : 0;

    const photosChanged = JSON.stringify(prevPhotosRef.current) !== JSON.stringify(activePhotos);
    const indexChanged = prevDefaultIndexRef.current !== newDefaultIndex;

    if (photosChanged || indexChanged) {
      prevPhotosRef.current = activePhotos;
      prevDefaultIndexRef.current = newDefaultIndex;

      setData((prevData) => ({
        ...prevData,
        photos: activePhotos.map(photo => photo._id || photo),
        default_photo_id: activePhotos.length > 0 ? (activePhotos[newDefaultIndex]?._id || activePhotos[newDefaultIndex]) : null
      }));
    }
  }, [photos, defaultPhotoIndex, disabledPhotos, setData]);

  function handleFileChange(e) {
    const value = e.target.name === 'photo_credit_url' ? createUrlSlug(e.target.value) : e.target.value;
    setUploadForm({ ...uploadForm, [e.target.name]: value });
    if (e.target.name !== 'photo_credit_url' && !useUrl) handlePhotoAdd(e);
  }

  function handleUrlChange(e) {
    const url = e.target.value;

    if (url) {
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace('www.', '');
        const domain = urlObj.origin;

        const hostnameParts = hostname.split('.');
        const mainDomain = hostnameParts.length >= 2
          ? hostnameParts[hostnameParts.length - 2]
          : hostnameParts[0];

        const capitalizedDomain = mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1);

        // Only assign the credit URL if the provided URL is safe
        const safeCreditUrl = isSafeImageUrl(url) ? domain : '';

        setUploadForm({
          ...uploadForm,
          photo_url: url,
          photo_credit: capitalizedDomain,
          photo_credit_url: safeCreditUrl
        });
      } catch (err) {
        setUploadForm({ ...uploadForm, photo_url: url });
      }
    } else {
      setUploadForm({ ...uploadForm, photo_url: '' });
    }
  }

  async function handleAddUrlToQueue() {
    if (!uploadForm.photo_url) {
      setAlertTitle(lang.current.modal.photoUrlRequired);
      setAlertMessage('Please enter a photo URL');
      setShowAlertModal(true);
      return;
    }

    try {
      new URL(uploadForm.photo_url);
    } catch (err) {
      setAlertTitle(lang.current.modal.photoUrlRequired);
      setAlertMessage('Please enter a valid URL');
      setShowAlertModal(true);
      return;
    }

    // Block potentially dangerous URLs (javascript:, data:, etc.)
    if (!isSafeImageUrl(uploadForm.photo_url)) {
      setAlertTitle(lang.current.modal.photoUrlRequired);
      setAlertMessage('This URL uses an unsupported protocol or is unsafe');
      setShowAlertModal(true);
      return;
    }

    const isDuplicate = urlQueue.some(item => item.url === uploadForm.photo_url);
    if (isDuplicate) {
      setAlertTitle(lang.current.modal.photoUrlRequired);
      setAlertMessage('This URL has already been added to the queue');
      setShowAlertModal(true);
      return;
    }

    const dimensions = await getImageDimensionsSafe(uploadForm.photo_url);

    const urlObject = {
      url: uploadForm.photo_url,
      photo_credit: uploadForm.photo_credit || 'Unknown',
      photo_credit_url: isSafeImageUrl(uploadForm.photo_credit_url) ? uploadForm.photo_credit_url : (isSafeImageUrl(uploadForm.photo_url) ? uploadForm.photo_url : ''),
      width: dimensions.width,
      height: dimensions.height
    };

    if (editingUrlIndex !== null) {
      const newQueue = [...urlQueue];
      newQueue[editingUrlIndex] = urlObject;
      setUrlQueue(newQueue);
      setEditingUrlIndex(null);
    } else {
      setUrlQueue([...urlQueue, urlObject]);
    }

    setUploadForm({ photo_credit: "", photo_credit_url: "", photo_url: "" });
  }

  function handleEditUrlInQueue(index) {
    const urlItem = urlQueue[index];
    setUploadForm({
      photo_url: urlItem.url,
      photo_credit: urlItem.photo_credit,
      photo_credit_url: urlItem.photo_credit_url
    });
    setEditingUrlIndex(index);
  }

  function handleRemoveUrlFromQueue(index) {
    setUrlQueue(urlQueue.filter((_, i) => i !== index));
    if (editingUrlIndex === index) {
      setEditingUrlIndex(null);
      setUploadForm({ photo_credit: "", photo_credit_url: "", photo_url: "" });
    }
  }

  async function handleUploadAllUrls() {
    if (urlQueue.length === 0) {
      setAlertTitle(lang.current.modal.photoUrlRequired);
      setAlertMessage('No URLs in queue to upload');
      setShowAlertModal(true);
      return;
    }

    setUploading(true);

    try {
      // Upload each URL to the backend to persist in database
      const uploadPromises = urlQueue.map(item =>
        uploadPhotoUrl({
          url: item.url,
          photo_credit: item.photo_credit || 'Unknown',
          photo_credit_url: item.photo_credit_url || item.url,
          width: item.width || undefined,
          height: item.height || undefined
        })
      );

      const uploadResults = await Promise.all(uploadPromises);
      const uploadedPhotos = uploadResults.map(result => result.upload);

      const newPhotos = [...photos, ...uploadedPhotos];
      setPhotos(newPhotos);

      if (photos.length === 0 && newPhotos.length > 0) {
        setDefaultPhotoIndex(0);
      }

      setUrlQueue([]);
      setEditingUrlIndex(null);
      setUploadForm({ photo_credit: "", photo_credit_url: "", photo_url: "" });

      setAlertTitle(lang.current.modal.photoUploadSuccess);
      setAlertMessage(`Successfully uploaded ${uploadedPhotos.length} photo(s) from URLs`);
      setShowAlertModal(true);
    } catch (err) {
      handleError(err);
    } finally {
      setUploading(false);
    }
  }

  async function handlePhotoAdd(e) {
    e.preventDefault();
    setUploading(true);

    try {
      if (useUrl) {
        if (!uploadForm.photo_url) {
          setAlertTitle(lang.current.modal.photoUrlRequired);
          setAlertMessage('Please enter a photo URL');
          setShowAlertModal(true);
          setUploading(false);
          return;
        }

        // Get image dimensions for layout shift prevention
        if (!isSafeImageUrl(uploadForm.photo_url)) {
          setAlertTitle(lang.current.modal.photoUrlRequired);
          setAlertMessage('This URL uses an unsupported protocol or is unsafe');
          setShowAlertModal(true);
          setUploading(false);
          return;
        }

        const dimensions = await getImageDimensionsSafe(uploadForm.photo_url);

        const urlData = {
          url: uploadForm.photo_url,
          photo_credit: uploadForm.photo_credit || 'Unknown',
          photo_credit_url: isSafeImageUrl(uploadForm.photo_credit_url) ? uploadForm.photo_credit_url : uploadForm.photo_url,
          width: dimensions.width || undefined,
          height: dimensions.height || undefined
        };

        const uploadedImage = await uploadPhotoUrl(urlData);

        const newPhotos = [...photos, uploadedImage.upload];
        setPhotos(newPhotos);

        if (newPhotos.length === 1) {
          setDefaultPhotoIndex(0);
        }
      } else {
        const fileInput = document.getElementById("image");
        const files = fileInput.files;

        if (!files || files.length === 0) {
          setUploading(false);
          return;
        }

        let uploadedPhotos = [];

        if (files.length === 1) {
          const dimensions = await getImageDimensionsSafe(files[0]);

          let formData = new FormData();
          formData.append("image", files[0]);
          if (uploadForm.photo_credit)
            formData.append("photo_credit", uploadForm.photo_credit);
          if (uploadForm.photo_credit_url)
            formData.append("photo_credit_url", uploadForm.photo_credit_url);
          if (data.name) formData.append("name", data.name);
          if (dimensions.width) formData.append("width", dimensions.width);
          if (dimensions.height) formData.append("height", dimensions.height);

          const uploadedImage = await uploadPhoto(formData);

          uploadedPhotos = [uploadedImage.upload];
        } else {
          const dimensionsArray = await Promise.all(
            Array.from(files).map(file => getImageDimensionsSafe(file))
          );

          let formData = new FormData();

          for (let i = 0; i < files.length; i++) {
            formData.append("images", files[i]);
          }

          formData.append("dimensions", JSON.stringify(dimensionsArray));

          if (uploadForm.photo_credit)
            formData.append("photo_credit", uploadForm.photo_credit);
          if (uploadForm.photo_credit_url)
            formData.append("photo_credit_url", uploadForm.photo_credit_url);
          if (data.name) formData.append("name", data.name);

          const response = await uploadPhotoBatch(formData);

          uploadedPhotos = response.uploads;
        }

        const newPhotos = [...photos, ...uploadedPhotos];
        setPhotos(newPhotos);

        if (photos.length === 0 && newPhotos.length > 0) {
          setDefaultPhotoIndex(0);
        }
      }

      setUploadForm({ photo_credit: "", photo_credit_url: "", photo_url: "" });

      const fileInput = document.getElementById("image");
      if (fileInput) {
        fileInput.value = '';
      }
    } catch (err) {
      handleError(err);
    } finally {
      setUploading(false);
    }
  }

  async function removePhotoAtIndex(index) {
    const photoToRemove = photos[index];

    if (photoToRemove._id) {
      try {
        await deletePhoto(photoToRemove._id);
        logger.info('Successfully deleted photo from server', { photoId: photoToRemove._id });
      } catch (err) {
        logger.error('Failed to delete photo from server', { photoId: photoToRemove._id, error: err.message });
        handleError(err);
        return;
      }
    }

    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);

    const newDisabledPhotos = new Set();
    disabledPhotos.forEach(disabledIdx => {
      if (disabledIdx < index) {
        newDisabledPhotos.add(disabledIdx);
      } else if (disabledIdx > index) {
        newDisabledPhotos.add(disabledIdx - 1);
      }
    });
    setDisabledPhotos(newDisabledPhotos);

    if (defaultPhotoIndex >= newPhotos.length) {
      setDefaultPhotoIndex(Math.max(0, newPhotos.length - 1));
    } else if (defaultPhotoIndex === index && newPhotos.length > 0) {
      setDefaultPhotoIndex(0);
    } else if (defaultPhotoIndex > index) {
      setDefaultPhotoIndex(defaultPhotoIndex - 1);
    }
  }

  function togglePhotoAtIndex(index) {
    const newDisabledPhotos = new Set(disabledPhotos);
    if (newDisabledPhotos.has(index)) {
      newDisabledPhotos.delete(index);
    } else {
      newDisabledPhotos.add(index);

      if (index === defaultPhotoIndex) {
        const firstActiveIndex = photos.findIndex((_, idx) => !newDisabledPhotos.has(idx));
        if (firstActiveIndex !== -1) {
          setDefaultPhotoIndex(firstActiveIndex);
        }
      }
    }
    setDisabledPhotos(newDisabledPhotos);
  }

  return (
    <div className={styles.uploadPhoto} role="region" aria-label={lang.current.aria.photoUpload}>
      {/* Upload Form */}
      <div className={styles.uploadFormSection}>
        {/* Photo Credit Fields - One Per Line */}
        <div className="mb-3">
          <label htmlFor="photo_credit" className="visually-hidden">
            Photo credit name
          </label>
          <FormControl
            type="text"
            name="photo_credit"
            id="photo_credit"
            onChange={handleFileChange}
            value={uploadForm.photo_credit || ''}
            placeholder={lang.current.placeholder.photoCredit}
            aria-label={lang.current.aria.photoCreditName}
          />
        </div>
        
        <div className="mb-3">
          <label htmlFor="photo_credit_url" className="visually-hidden">
            Photo credit URL
          </label>
          <FormControl
            type="text"
            name="photo_credit_url"
            id="photo_credit_url"
            onChange={handleFileChange}
            value={uploadForm.photo_credit_url || ''}
            placeholder={lang.current.placeholder.photoCreditUrl}
            aria-label={lang.current.aria.photoCreditUrl}
          />
        </div>

        {!useUrl ? (
          <>
            <label htmlFor="image" className="visually-hidden">
              Choose image file
            </label>
            <FormControl
              type="file"
              name="image"
              id="image"
              onChange={handleFileChange}
              accept="image/*"
              multiple
              aria-label={lang.current.aria.chooseImageFiles}
              aria-describedby="image-upload-help"
            />
            <span id="image-upload-help" className="visually-hidden">
              Accepted formats: JPG, PNG, GIF. Maximum size: 5MB per file. You can select multiple files.
            </span>
          </>
        ) : (
          <>
            <label htmlFor="photo_url" className="visually-hidden">
              Photo URL
            </label>
            <div className="input-group mb-3">
              <input
                type="url"
                name="photo_url"
                id="photo_url"
                onChange={handleUrlChange}
                value={uploadForm.photo_url || ''}
                className="form-control"
                placeholder="Enter direct image URL (e.g., https://example.com/image.jpg)"
                aria-label={lang.current.aria.photoUrl}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddUrlToQueue();
                  }
                }}
              />
              <button
                className="btn btn-outline-primary"
                type="button"
                onClick={handleAddUrlToQueue}
                title={editingUrlIndex !== null ? "Update URL in queue" : "Add URL to queue"}
                aria-label={editingUrlIndex !== null ? "Update URL in queue" : "Add URL to queue"}
              >
                {editingUrlIndex !== null ? '✓' : '✚'}
              </button>
            </div>

            {/* URL Queue Display */}
            {urlQueue.length > 0 && (
              <div className="url-queue mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <small className="text-muted">
                    URLs in queue ({urlQueue.length})
                  </small>
                  {urlQueue.length > 0 && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleUploadAllUrls}
                      disabled={uploading}
                    >
                      {uploading ? 'Uploading...' : `Upload All (${urlQueue.length})`}
                    </button>
                  )}
                </div>
                <div className={styles.urlQueueList}>
                  {urlQueue.map((item, index) => (
                    <div
                      key={index}
                      className={`url-queue-item ${editingUrlIndex === index ? 'editing' : ''}`}
                      onClick={() => handleEditUrlInQueue(index)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleEditUrlInQueue(index);
                        }
                      }}
                      aria-label={`Edit URL ${index + 1}: ${item.url}`}
                    >
                      <div className={styles.urlQueueItemContent}>
                        <div className={styles.urlQueueItemUrl}>{item.url}</div>
                        <div className={styles.urlQueueItemCredit}>
                          <small className="text-muted">
                            {item.photo_credit} {item.photo_credit_url && `• ${item.photo_credit_url}`}
                          </small>
                        </div>
                      </div>
                      <button
                        className="btn btn-sm btn-outline-danger url-queue-item-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveUrlFromQueue(index);
                        }}
                        aria-label={`Remove URL ${index + 1} from queue`}
                        title="Remove from queue"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="d-flex gap-2 align-items-center">
          {!useUrl && (
            <button
              className="btn btn-primary btn-sm upload-btn"
              onClick={handlePhotoAdd}
              disabled={uploading}
              aria-label={uploading ? lang.current.button.uploading : lang.current.button.upload}
              aria-busy={uploading}
            >
              {uploading ? lang.current.button.uploading : lang.current.button.upload}
            </button>
          )}
          <button
            className="btn btn-light btn-sm upload-toggle-btn"
            onClick={() => {
              setUseUrl(!useUrl);
              setUploadForm({ photo_credit: "", photo_credit_url: "", photo_url: "" });
              setUrlQueue([]);
              setEditingUrlIndex(null);
            }}
            type="button"
            aria-label={useUrl ? lang.current.aria.switchToFileUpload : lang.current.aria.useUrlInstead}
          >
            {useUrl ? "Upload a file instead" : "Add a URL instead"}
          </button>
        </div>
      </div>

      {/* Uploaded Photos List */}
      {photos.length > 0 && (
        <div className={styles.uploadedPhotosList} role="region" aria-label={lang.current.aria.uploadedPhotos}>
          <h5 className="mt-4 mb-3">
            Photos ({photos.filter((_, idx) => !disabledPhotos.has(idx)).length} active, {disabledPhotos.size} disabled)
          </h5>
          
          {disabledPhotos.size > 0 && (
            <Alert type="info" className="mb-3">
              <small>
                <strong>💡 Tip:</strong> Disabled photos (shown in gray with red border) will be removed when you save. 
                Click <strong>Enable</strong> to keep them.
              </small>
            </Alert>
          )}
          
          <div className={styles.photosGrid}>
            {photos.map((photo, index) => {
              const isDisabled = disabledPhotos.has(index);
              const isDefault = index === defaultPhotoIndex && !isDisabled;
              // Sanitize photo credit to prevent XSS - React will escape JSX text content
              const sanitizedCredit = sanitizeText(photo.photo_credit);
              // Validate URL is safe before using in img src
              const safeUrl = isSafeImageUrl(photo.url) ? photo.url : null;

              return (
                <div
                  key={index}
                  className={`photo-item ${isDisabled ? 'photo-item-disabled' : ''}`}
                  style={{ opacity: isDisabled ? 0.5 : 1 }}
                >
                  {safeUrl ? (
                    <img
                      src={safeUrl}
                      alt={sanitizedCredit || `Photo ${index + 1}`}
                      className={styles.photoItemPreview}
                      loading="lazy"
                      style={{ filter: isDisabled ? 'grayscale(100%)' : 'none' }}
                    />
                  ) : (
                    <div className={styles.photoItemPreview} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--color-bg-tertiary)',
                      color: 'var(--color-text-muted)',
                      fontSize: 'var(--font-size-sm)'
                    }}>
                      Invalid image URL
                    </div>
                  )}
                  <div className={styles.photoItemInfo}>
                    <small className={styles.photoItemCredit}>{sanitizedCredit}</small>
                    {isDefault && (
                      <span className="badge pill pill-variant-primary">Default</span>
                    )}
                    {isDisabled && (
                      <span className="badge pill pill-variant-danger">Disabled</span>
                    )}
                  </div>
                  <div className={styles.photoItemActions}>
                    <button
                      className={`btn btn-sm ${isDisabled ? 'btn-success' : 'btn-warning'}`}
                      onClick={() => togglePhotoAtIndex(index)}
                      aria-label={isDisabled ? `Enable photo ${index + 1}` : `Disable photo ${index + 1}`}
                      title={isDisabled ? 'Click to enable this photo' : 'Click to disable this photo'}
                    >
                      {isDisabled ? '✓ Enable' : '✗ Disable'}
                    </button>
                    {!isDisabled && index !== defaultPhotoIndex && (
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => setDefaultPhotoIndex(index)}
                        aria-label={`Set photo ${index + 1} as default`}
                      >
                        Set as Default
                      </button>
                    )}
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => {
                        setPhotoToDeleteIndex(index);
                        setShowDeleteConfirm(true);
                      }}
                      aria-label={`Remove photo ${index + 1} permanently`}
                      title="Permanently delete this photo"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      <AlertModal
        show={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        title={alertTitle || lang.current.modal.photoUrlRequired}
        message={alertMessage}
        variant="warning"
      />
      
      <ConfirmModal
        show={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setPhotoToDeleteIndex(null);
        }}
        onConfirm={async () => {
          if (photoToDeleteIndex !== null) {
            await removePhotoAtIndex(photoToDeleteIndex);
            setShowDeleteConfirm(false);
            setPhotoToDeleteIndex(null);
          }
        }}
        title="Delete Photo?"
        message="You are about to permanently delete this photo"
        confirmText="Delete Permanently"
        confirmVariant="danger"
      />
    </div>
  );
}
