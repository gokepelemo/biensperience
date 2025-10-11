import { useState } from "react";
import "./ImageUpload.css";
import { uploadPhoto, uploadPhotoUrl, deletePhoto } from "../../utilities/photos-api";
import { handleError } from "../../utilities/error-handler";
import { createUrlSlug } from "../../utilities/url-utils";
import { lang } from "../../lang.constants";

export default function ImageUpload({ data, setData }) {
  const [uploadForm, setUploadForm] = useState({});
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [useUrl, setUseUrl] = useState(false);

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

        setUploadForm({
          ...uploadForm,
          photo_url: url,
          photo_credit: hostname,
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
      let uploadedImage;

      if (useUrl) {
        // URL upload
        if (!uploadForm.photo_url) {
          alert('Please enter a photo URL');
          setUploading(false);
          return;
        }

        const urlData = {
          url: uploadForm.photo_url,
          photo_credit: uploadForm.photo_credit || 'Unknown',
          photo_credit_url: uploadForm.photo_credit_url || uploadForm.photo_url
        };

        uploadedImage = await uploadPhotoUrl(urlData);
      } else {
        // File upload
        let formData = new FormData();
        let image = document.getElementById("image").files[0];
        if (!image) {
          setUploading(false);
          return;
        }
        formData.append("image", image);
        if (uploadForm.photo_credit)
          formData.append("photo_credit", uploadForm.photo_credit);
        if (uploadForm.photo_credit_url)
          formData.append("photo_credit_url", uploadForm.photo_credit_url);
        if (data.name) formData.append("name", data.name);

        uploadedImage = await uploadPhoto(formData);
      }

      setPhotoUploaded(uploadedImage);
      setData({ ...data, photo: uploadedImage.upload._id });
      setUploadForm({ photo_credit: "", photo_credit_url: "", photo_url: "" });
    } catch (err) {
      handleError(err);
    } finally {
      setUploading(false);
    }
  }
  async function removeImage() {
    if (!data.photo) return;
    try {
      await deletePhoto(data.photo);
      setPhotoUploaded(null);
      setData({ ...data, photo: null });
    } catch (err) {
      handleError(err);
    }
  }
  return (
    <div className="uploadPhoto" role="region" aria-label="Photo upload">
      {!photoUploaded ? (
        <>
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
                aria-label="Choose image file to upload"
                aria-describedby="image-upload-help"
              />
              <span id="image-upload-help" className="visually-hidden">
                Accepted formats: JPG, PNG, GIF. Maximum size: 5MB
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

          <div className="d-flex gap-2">
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
              className="btn btn-light btn-sm"
              onClick={() => {
                setUseUrl(!useUrl);
                setUploadForm({ photo_credit: "", photo_credit_url: "", photo_url: "" });
              }}
              type="button"
              aria-label={useUrl ? "Switch to file upload" : "Use a URL instead"}
            >
              {useUrl ? "Upload File" : "Use a URL instead"}
            </button>
          </div>
        </>
      ) : (
        <div role="region" aria-label="Uploaded photo preview">
          <img
            className="previewImg"
            src={photoUploaded.upload.url}
            alt={`${lang.en.image.alt.preview} - ${uploadForm.photo_credit || 'Uploaded image'}`}
            loading="lazy"
          />
          <button
            className="btn btn-danger btn-sm removeImg"
            onClick={removeImage}
            disabled={uploading}
            aria-label="Remove uploaded photo"
            aria-busy={uploading}
          >
            <span aria-hidden="true">❌</span>
            <span className="visually-hidden">Remove</span>
          </button>
        </div>
      )}
    </div>
  );
}
