import "./Profile.css";
import { useState } from "react";
import ImageUpload from "../../components/ImageUpload/ImageUpload";
import { updateUser } from "../../utilities/users-api";
import { lang } from "../../lang.constants";
import PageMeta from "../../components/PageMeta/PageMeta";
export default function Profile({ user, setUser, updateData }) {
  const [formData, setFormData] = useState(user);
  const disableSubmit = formData.password !== formData.confirm;
  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }
  async function handleSubmit(e) {
    e.preventDefault();
    try {
      let updatedUser = await updateUser(user._id, formData);
      setUser(updatedUser);
      updateData && updateData();
    } catch (err) {
      console.error('Failed to update profile:', err);
    }
  }
  return (
    <>
      <PageMeta
        title={`Edit Profile - ${user.name}`}
        description={`Update your Biensperience profile settings, change your name, email, and profile photo. Manage your travel planning account.`}
        keywords="edit profile, update profile, account settings, profile photo, user settings"
        ogTitle={`Edit Profile - ${user.name}`}
        ogDescription="Update your Biensperience profile and account settings"
      />
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
