import { useState } from "react";
import "./ImageUpload.css";
import { uploadPhoto, deletePhoto } from "../../utilities/photos-api";

export default function ImageUpload({ data, setData }) {
  const [uploadForm, setUploadForm] = useState({});
  const [photoUploaded, setPhotoUploaded] = useState(0);
  function handleFileChange(e) {
    setUploadForm({ ...uploadForm, [e.target.name]: e.target.value });
  }
  async function handlePhotoAdd(e) {
    e.preventDefault();
    let formData = new FormData();
    let image = document.getElementById("image").files[0];
    formData.append("image", image);
    formData.append("photo_credit", uploadForm.photo_credit);
    formData.append("name", data.name);
    let uploadedImage = await uploadPhoto(formData);
    setPhotoUploaded(uploadedImage);
    setData({ ...data, photo: uploadedImage.upload._id });
    setUploadForm({ photo_credit: "" });
  }
  function removeImage() {
    deletePhoto(data.photo);
    setPhotoUploaded(false);
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
            placeholder="Photo Credit"
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
          <button className="btn btn-light btn-sm upload-btn" onClick={handlePhotoAdd}>
            Upload
          </button>
        </>
      ) : (
        <>
          <img className="previewImg" src={photoUploaded.upload.url} />
          <button className="btn btn-light btn-sm removeImg" onClick={removeImage}>
            ❌
          </button>
        </>
      )}
    </div>
  );
}
