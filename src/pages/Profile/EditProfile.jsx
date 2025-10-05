import "./Profile.css";
import { useState } from "react";
import ImageUpload from "../../components/ImageUpload/ImageUpload";
import { updateUser } from "../../utilities/users-api";
import { lang } from "../../lang.constants";
export default function Profile({ user, setUser }) {
  const [formData, setFormData] = useState(user);
  const disableSubmit = formData.password !== formData.confirm;
  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }
  async function handleSubmit(e) {
    let updatedUser = updateUser(user._id, formData);
    setUser(updatedUser);
  }
  return (
    <>
      <h1 className="h my-4">{lang.en.heading.updateProfile.replace('{name}', user.name)}</h1>
      <form className="editProfile" autoComplete="off" onSubmit={handleSubmit}>
        <input
          type="text"
          name="name"
          className="form-control"
          placeholder={lang.en.placeholder.nameField}
          onChange={handleChange}
          value={formData.name}
        />
        <input
          type="text"
          name="email"
          className="form-control"
          placeholder={lang.en.placeholder.emailField}
          onChange={handleChange}
          value={formData.email}
        />
        <ImageUpload data={formData} setData={setFormData} />
        <button
          type="submit"
          className="btn btn-light"
          disabled={disableSubmit}
        >
          {lang.en.button.update}
        </button>
      </form>
      <p className="error-message">&nbsp;{formData.error}</p>
    </>
  );
}
