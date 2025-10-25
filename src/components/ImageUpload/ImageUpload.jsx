import { useState, useEffect, useRef } from "react";
import "./ImageUpload.css";
import { uploadPhoto, uploadPhotoBatch, deletePhoto } from "../../utilities/photos-api";
import { handleError } from "../../utilities/error-handler";
import { createUrlSlug } from "../../utilities/url-utils";
import { lang } from "../../lang.constants";
import Alert from "../Alert/Alert";
import AlertModal from "../AlertModal/AlertModal";
import ConfirmModal from "../ConfirmModal/ConfirmModal";
import { logger } from "../../utilities/logger";

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

export default function ImageUpload({ data, setData }) {
  const [uploadForm, setUploadForm] = useState({});
  const [uploading, setUploading] = useState(false);
  const [useUrl, setUseUrl] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [photoToDeleteIndex, setPhotoToDeleteIndex] = useState(null);

  // Initialize photos array from data - only once on mount
  const [photos, setPhotos] = useState(() => data.photos || []);
  const [defaultPhotoIndex, setDefaultPhotoIndex] = useState(() => data.default_photo_index || 0);
  
  // Track which photos are toggled off (marked for removal)
  const [disabledPhotos, setDisabledPhotos] = useState(() => new Set());
  
  // Use ref to track previous values to prevent unnecessary updates
  const prevPhotosRef = useRef();
  const prevDefaultIndexRef = useRef();

  // Update parent data when photos change - optimized to prevent loops
  useEffect(() => {
    // Filter out disabled photos before sending to parent
    const activePhotos = photos.filter((_, index) => !disabledPhotos.has(index));
    
    // Adjust default photo index for active photos only
    let adjustedDefaultIndex = defaultPhotoIndex;
    if (disabledPhotos.has(defaultPhotoIndex)) {
      // Find first active photo
      adjustedDefaultIndex = photos.findIndex((_, idx) => !disabledPhotos.has(idx));
      if (adjustedDefaultIndex === -1) adjustedDefaultIndex = 0;
    } else {
      // Calculate adjusted index accounting for disabled photos before default
      adjustedDefaultIndex = photos
        .slice(0, defaultPhotoIndex)
        .filter((_, idx) => !disabledPhotos.has(idx))
        .length;
    }
    
    const newDefaultIndex = activePhotos.length > 0 ? adjustedDefaultIndex : 0;
    
    // Check if values actually changed using ref comparison
    const photosChanged = JSON.stringify(prevPhotosRef.current) !== JSON.stringify(activePhotos);
    const indexChanged = prevDefaultIndexRef.current !== newDefaultIndex;
    
    if (photosChanged || indexChanged) {
      // Update refs
      prevPhotosRef.current = activePhotos;
      prevDefaultIndexRef.current = newDefaultIndex;
      
      // Create a shallow copy of data and only update photos fields
      // This prevents unnecessary re-renders in parent components
      setData((prevData) => ({
        ...prevData,
        photos: activePhotos,
        default_photo_index: newDefaultIndex
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

    // Auto-fill photo credit fields from URL
    if (url) {
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace('www.', '');
        const domain = urlObj.origin;
        
        // Extract main domain name (e.g., "facebook" from "images.cdn.facebook.com")
        const hostnameParts = hostname.split('.');
        // Get the second-to-last part (the main domain name before TLD)
        const mainDomain = hostnameParts.length >= 2 
          ? hostnameParts[hostnameParts.length - 2]
          : hostnameParts[0];
        
        // Capitalize first letter
        const capitalizedDomain = mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1);

        setUploadForm({
          ...uploadForm,
          photo_url: url,
          photo_credit: capitalizedDomain,
          photo_credit_url: domain
        });
      } catch (err) {
        // Invalid URL, just update photo_url
        setUploadForm({ ...uploadForm, photo_url: url });
      }
    } else {
      setUploadForm({ ...uploadForm, photo_url: '' });
    }
  }
  async function handlePhotoAdd(e) {
    e.preventDefault();
    setUploading(true);

    try {
      if (useUrl) {
        // URL upload - create photo object directly
        if (!uploadForm.photo_url) {
          setAlertMessage('Please enter a photo URL');
          setShowAlertModal(true);
          setUploading(false);
          return;
        }

        const photoObject = {
          url: uploadForm.photo_url,
          photo_credit: uploadForm.photo_credit || 'Unknown',
          photo_credit_url: uploadForm.photo_credit_url || uploadForm.photo_url
        };

        // Add single URL photo to photos array
        const newPhotos = [...photos, photoObject];
        setPhotos(newPhotos);

        // If this is the first photo, set it as default
        if (newPhotos.length === 1) {
          setDefaultPhotoIndex(0);
        }
      } else {
        // File upload - handle multiple files
        const fileInput = document.getElementById("image");
        const files = fileInput.files;
        
        if (!files || files.length === 0) {
          setUploading(false);
          return;
        }

        let uploadedPhotos = [];

        if (files.length === 1) {
          // Single file upload
          let formData = new FormData();
          formData.append("image", files[0]);
          if (uploadForm.photo_credit)
            formData.append("photo_credit", uploadForm.photo_credit);
          if (uploadForm.photo_credit_url)
            formData.append("photo_credit_url", uploadForm.photo_credit_url);
          if (data.name) formData.append("name", data.name);

          const uploadedImage = await uploadPhoto(formData);

          uploadedPhotos = [{
            _id: uploadedImage.upload._id,
            url: uploadedImage.upload.url,
            photo_credit: uploadedImage.upload.photo_credit || 'Unknown',
            photo_credit_url: uploadedImage.upload.photo_credit_url || ''
          }];
        } else {
          // Batch file upload
          let formData = new FormData();
          
          // Append all files
          for (let i = 0; i < files.length; i++) {
            formData.append("images", files[i]);
          }
          
          if (uploadForm.photo_credit)
            formData.append("photo_credit", uploadForm.photo_credit);
          if (uploadForm.photo_credit_url)
            formData.append("photo_credit_url", uploadForm.photo_credit_url);
          if (data.name) formData.append("name", data.name);

          const response = await uploadPhotoBatch(formData);

          uploadedPhotos = response.uploads.map(upload => ({
            _id: upload._id,
            url: upload.url,
            photo_credit: upload.photo_credit || 'Unknown',
            photo_credit_url: upload.photo_credit_url || ''
          }));
        }

        // Add all uploaded photos to photos array
        const newPhotos = [...photos, ...uploadedPhotos];
        setPhotos(newPhotos);

        // If these are the first photos, set first as default
        if (photos.length === 0 && newPhotos.length > 0) {
          setDefaultPhotoIndex(0);
        }
      }

      // Clear form
      setUploadForm({ photo_credit: "", photo_credit_url: "", photo_url: "" });

      // Reset file input
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
    
    // If photo has been saved to database (has _id), delete it from S3 and database
    if (photoToRemove._id) {
      try {
        await deletePhoto(photoToRemove._id);
        logger.info('Successfully deleted photo from server', { photoId: photoToRemove._id });
      } catch (err) {
        logger.error('Failed to delete photo from server', { error: err.message, photoId: photoToRemove._id }, err);
        handleError(err);
        return; // Don't remove from local array if server deletion failed
      }
    }
    
    // Remove from local array
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);

    // Update disabled photos set - adjust indices
    const newDisabledPhotos = new Set();
    disabledPhotos.forEach(disabledIdx => {
      if (disabledIdx < index) {
        newDisabledPhotos.add(disabledIdx);
      } else if (disabledIdx > index) {
        newDisabledPhotos.add(disabledIdx - 1);
      }
    });
    setDisabledPhotos(newDisabledPhotos);

    // Adjust default photo index if necessary
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
      
      // If disabling the default photo, set a new default
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
    <div className="uploadPhoto" role="region" aria-label="Photo upload">
      {/* Upload Form */}
      <div className="upload-form-section">
        {/* Photo Credit Fields - One Per Line */}
        <div className="mb-3">
          <label htmlFor="photo_credit" className="visually-hidden">
            Photo credit name
          </label>
          <input
            type="text"
            name="photo_credit"
            id="photo_credit"
            onChange={handleFileChange}
            value={uploadForm.photo_credit || ''}
            className="form-control"
            placeholder={lang.en.placeholder.photoCredit}
            aria-label="Photo credit name"
          />
        </div>
        
        <div className="mb-3">
          <label htmlFor="photo_credit_url" className="visually-hidden">
            Photo credit URL
          </label>
          <input
            type="text"
            name="photo_credit_url"
            id="photo_credit_url"
            onChange={handleFileChange}
            value={uploadForm.photo_credit_url || ''}
            className="form-control"
            placeholder={lang.en.placeholder.photoCreditUrl}
            aria-label="Photo credit URL"
          />
        </div>

        {!useUrl ? (
          <>
            <label htmlFor="image" className="visually-hidden">
              Choose image file
            </label>
            <input
              type="file"
              name="image"
              id="image"
              onChange={handleFileChange}
              className="form-control"
              accept="image/*"
              multiple
              aria-label="Choose image files to upload"
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
            <input
              type="url"
              name="photo_url"
              id="photo_url"
              onChange={handleUrlChange}
              value={uploadForm.photo_url || ''}
              className="form-control"
              placeholder="Enter direct image URL (e.g., https://example.com/image.jpg)"
              aria-label="Photo URL"
            />
          </>
        )}

        <div className="d-flex gap-2 align-items-center">
          <button
            className="btn btn-primary btn-sm upload-btn"
            onClick={handlePhotoAdd}
            disabled={uploading}
            aria-label={uploading ? lang.en.button.uploading : lang.en.button.upload}
            aria-busy={uploading}
          >
            {uploading ? lang.en.button.uploading : lang.en.button.upload}
          </button>
          <button
            className="btn btn-light btn-sm upload-toggle-btn"
            onClick={() => {
              setUseUrl(!useUrl);
              setUploadForm({ photo_credit: "", photo_credit_url: "", photo_url: "" });
            }}
            type="button"
            aria-label={useUrl ? "Switch to file upload" : "Use a URL instead"}
          >
            {useUrl ? "Upload a file instead" : "Add a URL instead"}
          </button>
        </div>
      </div>

      {/* Uploaded Photos List */}
      {photos.length > 0 && (
        <div className="uploaded-photos-list" role="region" aria-label="Uploaded photos">
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
          
          <div className="photos-grid">
            {photos.map((photo, index) => {
              const isDisabled = disabledPhotos.has(index);
              const isDefault = index === defaultPhotoIndex && !isDisabled;
              // Sanitize photo credit to prevent XSS - React will escape JSX text content
              const sanitizedCredit = sanitizeText(photo.photo_credit);
              
              return (
                <div 
                  key={index} 
                  className={`photo-item ${isDisabled ? 'photo-item-disabled' : ''}`}
                  style={{ opacity: isDisabled ? 0.5 : 1 }}
                >
                  <img
                    src={photo.url}
                    alt={sanitizedCredit || `Photo ${index + 1}`}
                    className="photo-item-preview"
                    loading="lazy"
                    style={{ filter: isDisabled ? 'grayscale(100%)' : 'none' }}
                  />
                  <div className="photo-item-info">
                    <small className="photo-item-credit">{sanitizedCredit}</small>
                    {isDefault && (
                      <span className="badge bg-primary">Default</span>
                    )}
                    {isDisabled && (
                      <span className="badge bg-danger">Disabled</span>
                    )}
                  </div>
                  <div className="photo-item-actions">
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
        title="Photo URL Required"
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
        title="Delete Photo"
        message="Are you sure you want to permanently delete this photo? This action cannot be undone."
        confirmText="Delete Photo"
        confirmVariant="danger"
      />
    </div>
  );
}
