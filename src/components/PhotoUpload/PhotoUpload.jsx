import { useState, useEffect, useRef } from "react";
import styles from "./PhotoUpload.module.scss";
import DOMPurify from "dompurify";
import { uploadPhoto, uploadPhotoBatch, uploadPhotoUrl, deletePhoto } from "../../utilities/photos-api";
import { handleError } from "../../utilities/error-handler";
import { createUrlSlug } from "../../utilities/url-utils";
import { getImageDimensionsSafe } from "../../utilities/image-utils";
import { lang } from "../../lang.constants";
import Alert from "../Alert/Alert";
import AlertModal from "../AlertModal/AlertModal";
import ConfirmModal from "../ConfirmModal/ConfirmModal";
import { logger } from "../../utilities/logger";
import { FormControl, Pill } from "../../components/design-system";
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

function sanitizeText(text) {
  return text ? String(text).trim() : '';
}

function isSafeImageUrl(url) {
  if (!url || typeof url !== 'string') return false;

  const trimmedUrl = url.trim().toLowerCase();
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://') || trimmedUrl.startsWith('/')) {
    return true;
  }

  if (trimmedUrl.startsWith('javascript:') || trimmedUrl.startsWith('data:') || trimmedUrl.startsWith('vbscript:')) {
    return false;
  }

  if (!trimmedUrl.includes(':')) return true;

  return false;
}

function sanitizeImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmedUrl = url.trim();
  const lowerUrl = trimmedUrl.toLowerCase();
  if (lowerUrl.startsWith('javascript:') || lowerUrl.startsWith('data:') || lowerUrl.startsWith('vbscript:')) {
    return null;
  }
  if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://') && !lowerUrl.startsWith('/') && lowerUrl.includes(':')) {
    return null;
  }
  const sanitized = DOMPurify.sanitize(trimmedUrl, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  if (!sanitized || sanitized !== trimmedUrl) return null;
  return trimmedUrl;
}

export default function PhotoUpload({ data, setData }) {
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
  const [showCreditFields, setShowCreditFields] = useState(false);

  const [photos, setPhotos] = useState(() => {
    if (Array.isArray(data.photos_full) && data.photos_full.length > 0) return data.photos_full;
    return data.photos || [];
  });

  const [defaultPhotoIndex, setDefaultPhotoIndex] = useState(() => {
    const source = Array.isArray(data.photos_full) && data.photos_full.length > 0 ? data.photos_full : data.photos || [];
    if (data.default_photo_id && source) {
      const index = source.findIndex(photo =>
        (photo && photo._id && String(photo._id) === String(data.default_photo_id)) || String(photo) === String(data.default_photo_id)
      );
      return index >= 0 ? index : 0;
    }
    return 0;
  });

  const [disabledPhotos, setDisabledPhotos] = useState(() => new Set());

  const prevPhotosRef = useRef();
  const prevDefaultIndexRef = useRef();
  // Track if we've initialized from external data to avoid resetting user's edits
  const initializedFromDataRef = useRef(false);

  // Sync photos from external data prop when it changes (e.g., when modal opens with existing photos)
  // This handles the case where data.photos_full is populated after the component mounts
  useEffect(() => {
    const externalPhotos = Array.isArray(data.photos_full) && data.photos_full.length > 0
      ? data.photos_full
      : (Array.isArray(data.photos) ? data.photos : []);

    // Only sync if we have external photos AND we haven't initialized yet
    // OR if external photos changed significantly (e.g., modal reopened with different entity)
    if (externalPhotos.length > 0 && !initializedFromDataRef.current) {
      setPhotos(externalPhotos);

      // Also sync default photo index
      if (data.default_photo_id) {
        const index = externalPhotos.findIndex(photo =>
          (photo && photo._id && String(photo._id) === String(data.default_photo_id)) ||
          String(photo) === String(data.default_photo_id)
        );
        if (index >= 0) setDefaultPhotoIndex(index);
      }

      initializedFromDataRef.current = true;
      logger.debug('[PhotoUpload] Synced photos from external data', { count: externalPhotos.length });
    }
  }, [data.photos_full, data.photos, data.default_photo_id]);

  // Reset initialized flag when photos are cleared (e.g., modal closed and reopened)
  useEffect(() => {
    const externalPhotos = Array.isArray(data.photos_full) && data.photos_full.length > 0
      ? data.photos_full
      : (Array.isArray(data.photos) ? data.photos : []);

    if (externalPhotos.length === 0 && photos.length === 0) {
      initializedFromDataRef.current = false;
    }
  }, [data.photos_full, data.photos, photos.length]);

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

      const photoIds = activePhotos.map(photo => photo._id || photo);

      setData((prevData) => ({
        ...prevData,
        photos: photoIds,
        photos_full: activePhotos,
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
      setAlertMessage(lang.current.photo.enterPhotoUrl);
      setShowAlertModal(true);
      return;
    }

    try {
      new URL(uploadForm.photo_url);
    } catch (err) {
      setAlertTitle(lang.current.modal.photoUrlRequired);
      setAlertMessage(lang.current.photo.enterValidUrl);
      setShowAlertModal(true);
      return;
    }

    if (!isSafeImageUrl(uploadForm.photo_url)) {
      setAlertTitle(lang.current.modal.photoUrlRequired);
      setAlertMessage(lang.current.photo.unsafeUrl);
      setShowAlertModal(true);
      return;
    }

    const isDuplicate = urlQueue.some(item => item.url === uploadForm.photo_url);
    if (isDuplicate) {
      setAlertTitle(lang.current.modal.photoUrlRequired);
      setAlertMessage(lang.current.photo.urlAlreadyAdded);
      setShowAlertModal(true);
      return;
    }

    const dimensions = await getImageDimensionsSafe(uploadForm.photo_url);

    const urlObject = {
      url: uploadForm.photo_url,
      photo_credit: uploadForm.photo_credit || 'Biensperience',
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
      setAlertMessage(lang.current.photo.noUrlsInQueue);
      setShowAlertModal(true);
      return;
    }

    setUploading(true);

    try {
      const uploadPromises = urlQueue.map(item =>
        uploadPhotoUrl({
          url: item.url,
          photo_credit: item.photo_credit || 'Biensperience',
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
      setAlertMessage(lang.current.photo.uploadSuccess.replace('{count}', uploadedPhotos.length));
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
          setAlertMessage(lang.current.photo.enterPhotoUrl);
          setShowAlertModal(true);
          setUploading(false);
          return;
        }

        if (!isSafeImageUrl(uploadForm.photo_url)) {
          setAlertTitle(lang.current.modal.photoUrlRequired);
          setAlertMessage(lang.current.photo.unsafeUrl);
          setShowAlertModal(true);
          setUploading(false);
          return;
        }

        const dimensions = await getImageDimensionsSafe(uploadForm.photo_url);

        const urlData = {
          url: uploadForm.photo_url,
          photo_credit: uploadForm.photo_credit || 'Biensperience',
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
      <div className={styles.uploadFormSection}>
        {showCreditFields ? (
          <>
            <div className="mb-3">
              <label htmlFor="photo_credit" className="visually-hidden">
                {lang.current.photo.creditName}
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
                {lang.current.photo.creditUrl}
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
          </>
        ) : (
          <div className="mb-3">
            <button
              type="button"
              className="btn btn-link p-0 text-decoration-none"
              onClick={() => setShowCreditFields(true)}
              aria-expanded={showCreditFields}
            >
              + Add Photo Credits
            </button>
          </div>
        )}

        {!useUrl ? (
          <>
            <label htmlFor="image" className="visually-hidden">
              {lang.current.photo.chooseFile}
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
              {lang.current.photo.acceptedFormats}
            </span>
          </>
        ) : (
          <>
            <label htmlFor="photo_url" className="visually-hidden">
              {lang.current.photo.photoUrl}
            </label>
            <div className="input-group mb-3">
              <input
                type="url"
                name="photo_url"
                id="photo_url"
                onChange={handleUrlChange}
                value={uploadForm.photo_url || ''}
                className="form-control"
                placeholder={lang.current.photo.directImageUrl}
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
                title={editingUrlIndex !== null ? lang.current.photo.updateUrlInQueue : lang.current.photo.addUrlToQueue}
                aria-label={editingUrlIndex !== null ? lang.current.photo.updateUrlInQueue : lang.current.photo.addUrlToQueue}
              >
                {editingUrlIndex !== null ? '✓' : '✚'}
              </button>
            </div>

            {urlQueue.length > 0 && (
              <div className="url-queue mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <small className="text-muted">
                    {lang.current.photo.urlsInQueue.replace('{count}', urlQueue.length)}
                  </small>
                  {urlQueue.length > 0 && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleUploadAllUrls}
                      disabled={uploading}
                    >
                      {uploading ? lang.current.button.uploading : lang.current.photo.uploadAllUrls.replace('{count}', urlQueue.length)}
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
            {useUrl ? lang.current.photo.uploadFile : lang.current.photo.addUrl}
          </button>
        </div>
      </div>

      {photos.length > 0 && (
        <div className={styles.uploadedPhotosList} role="region" aria-label={lang.current.aria.uploadedPhotos}>
          <div className={styles.photosHeader}>
            <h5>{lang.current.photo.photos}</h5>
            <div className={styles.photosBadges}>
              <Pill variant="success" size="sm">
                {photos.filter((_, idx) => !disabledPhotos.has(idx)).length} Active
              </Pill>
              {disabledPhotos.size > 0 && (
                <Pill variant="danger" size="sm">
                  {disabledPhotos.size} Disabled
                </Pill>
              )}
            </div>
          </div>

          {disabledPhotos.size > 0 && (
            <Alert type="info" className="mb-3">
              <small>
                <strong>{lang.current.photo.tipLabel}</strong> {lang.current.photo.tipDisabledPhotos}{' '}
                <span dangerouslySetInnerHTML={{ __html: lang.current.photo.tipEnablePhotos }} />
              </small>
            </Alert>
          )}

          <div className={styles.photosCarousel}>
            <Slider
              dots={false}
              infinite={false}
              speed={300}
              slidesToShow={photos.length >= 3 ? 3 : photos.length}
              slidesToScroll={1}
              swipeToSlide={true}
              arrows={photos.length > 3}
              variableWidth={false}
              responsive={[
                {
                  breakpoint: 1200,
                  settings: {
                    slidesToShow: photos.length >= 2 ? 2 : photos.length,
                    arrows: photos.length > 2
                  }
                },
                {
                  breakpoint: 768,
                  settings: {
                    slidesToShow: 1,
                    arrows: false,
                    dots: photos.length > 1
                  }
                }
              ]
            }>
              {photos.map((photo, index) => {
                const isDisabled = disabledPhotos.has(index);
                const isDefault = index === defaultPhotoIndex && !isDisabled;
                const sanitizedCredit = sanitizeText(photo.photo_credit);
                const safeUrl = sanitizeImageUrl(photo.url);

                return (
                  <div key={index} className={styles.photoSlide}>
                    <div
                      className={`${styles.photoCard} ${isDisabled ? styles.photoCardDisabled : ''}`}
                    >
                      <div className={styles.photoCardImageWrapper}>
                        {safeUrl ? (
                          <img
                            src={safeUrl}
                            alt={sanitizedCredit || `Photo ${index + 1}`}
                            className={styles.photoCardImage}
                            loading="lazy"
                            style={{ filter: isDisabled ? 'grayscale(100%)' : 'none' }}
                          />
                        ) : (
                          <div className={styles.photoCardImage} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'var(--color-bg-tertiary)',
                            color: 'var(--color-text-muted)',
                            fontSize: 'var(--font-size-sm)'
                          }}>
                            {lang.current.photo.invalidUrl}
                          </div>
                        )}
                        {isDefault && (
                          <div className={styles.photoCardBadge}>
                            <Pill variant="primary" size="sm">{lang.current.photo.defaultBadge}</Pill>
                          </div>
                        )}
                        {isDisabled && (
                          <div className={styles.photoCardBadge}>
                            <Pill variant="danger" size="sm">{lang.current.photo.disabledBadge}</Pill>
                          </div>
                        )}
                      </div>
                      <div className={styles.photoCardContent}>
                        <small className={styles.photoCardCredit} title={sanitizedCredit}>
                          {sanitizedCredit}
                        </small>
                        <div className={styles.photoCardActions}>
                          <button
                            type="button"
                            className={`btn btn-sm ${isDisabled ? 'btn-success' : 'btn-warning'}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              togglePhotoAtIndex(index);
                            }}
                            aria-label={isDisabled ? `Enable photo ${index + 1}` : `Disable photo ${index + 1}`}
                            title={lang.current.photo.clickToToggle}
                          >
                            {isDisabled ? '✓' : '✕'}
                          </button>
                          {!isDisabled && index !== defaultPhotoIndex && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDefaultPhotoIndex(index);
                              }}
                              aria-label={`Set photo ${index + 1} as default`}
                              title={lang.current.photo.setAsDefault}
                            >
                              ⭐
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setPhotoToDeleteIndex(index);
                              setShowDeleteConfirm(true);
                            }}
                            aria-label={`Remove photo ${index + 1} permanently`}
                            title={lang.current.photo.deletePhotoConfirm}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </Slider>
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
        title={lang.current.photo.deletePhotoTitle}
        message={lang.current.photo.deletePhotoMessage}
        confirmText={lang.current.photo.deletePhotoConfirm}
        confirmVariant="danger"
      />
    </div>
  );
}
