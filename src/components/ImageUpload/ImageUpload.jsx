import { useState } from "react";
import "./ImageUpload.css";
import { uploadPhoto, deletePhoto } from "../../utilities/photos-api";
import { handleError } from "../../utilities/error-handler";
import { createUrlSlug } from "../../utilities/url-utils";

export default function ImageUpload({ data, setData }) {
  const [uploadForm, setUploadForm] = useState({});
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  function handleFileChange(e) {
    const value = e.target.name === 'photo_credit_url' ? createUrlSlug(e.target.value) : e.target.value;
    setUploadForm({ ...uploadForm, [e.target.name]: value });
    if (e.target.name !== 'photo_credit_url') handlePhotoAdd(e);
  }
  async function handlePhotoAdd(e) {
    e.preventDefault();
    let formData = new FormData();
    let image = document.getElementById("image").files[0];
    if (!image) return;
    formData.append("image", image);
    if (uploadForm.photo_credit)
      formData.append("photo_credit", uploadForm.photo_credit);
    if (uploadForm.photo_credit_url)
      formData.append("photo_credit_url", uploadForm.photo_credit_url);
    if (uploadForm.name) formData.append("name", data.name);
    setUploading(!uploading)
    let uploadedImage = await uploadPhoto(formData);
    setPhotoUploaded(uploadedImage);
    setData({ ...data, photo: uploadedImage.upload._id });
    setUploadForm({ photo_credit: "", photo_credit_url: "" });
  }
  async function removeImage(e) {
    e.preventDefault();
    setUploading(!uploading)
    try {
      await deletePhoto(data.photo);
      setPhotoUploaded(false);
    } catch (err) {
      handleError(err, { context: 'Delete photo' });
    }
    setData({ photo: "" });
  }
  return (
    <div className="uploadPhoto">
      {!photoUploaded ? (
        <>
          <input
            type="text"
            name="photo_credit"
            onChange={handleFileChange}
            value={uploadForm.photo_credit}
            className="form-control"
            placeholder="Photo Credit e.g. Unsplash"
          />
          <input
            type="text"
            name="photo_credit_url"
            onChange={handleFileChange}
            value={uploadForm.photo_credit_url}
            className="form-control"
            placeholder="Photo Credit URL e.g. http://unsplash.com"
          />
          <input
            type="file"
            name="image"
            id="image"
            onChange={handleFileChange}
            className="form-control"
          />
          <button
            className="btn btn-light btn-sm upload-btn"
            onClick={handlePhotoAdd}
          >
            {uploading ? `Uploading...` : `Upload`}
          </button>
        </>
      ) : (
        <>
    <img className="previewImg" src={photoUploaded.upload.url} alt="Preview" />
            <img className="previewImg" src={photoUploaded.upload.url} alt="Preview" />
          <button
            className="btn btn-light btn-sm removeImg"
            onClick={removeImage}
          >
            ❌
          </button>
        </>
      )}
    </div>
  );
}
