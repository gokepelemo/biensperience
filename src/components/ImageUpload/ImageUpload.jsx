import { useState } from "react";
import "./ImageUpload.css";
import { uploadPhoto, deletePhoto } from "../../utilities/photos-api";

export default function ImageUpload({ data, setData }) {
  const [uploadForm, setUploadForm] = useState({});
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  function handleFileChange(e) {
    setUploadForm({ ...uploadForm, [e.target.name]: e.target.value });
    handlePhotoAdd(e);
  }
  async function handlePhotoAdd(e) {
    e.preventDefault();
    let formData = new FormData();
    let image = document.getElementById("image").files[0];
    if (!image) return;
    formData.append("image", image);
    if (uploadForm.photo_credit)
      formData.append("photo_credit", uploadForm.photo_credit);
    if (uploadForm.name) formData.append("name", data.name);
    setUploading(!uploading)
    let uploadedImage = await uploadPhoto(formData);
    setPhotoUploaded(uploadedImage);
    setData({ ...data, photo: uploadedImage.upload._id });
    setUploadForm({ photo_credit: "" });
  }
  async function removeImage(e) {
    e.preventDefault();
    setUploading(!uploading)
    try {
      await deletePhoto(data.photo);
      setPhotoUploaded(false);
    } catch (err) {
      console.error(err);
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
          <img className="previewImg" src={photoUploaded.upload.url} />
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
