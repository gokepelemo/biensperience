import "./Profile.css";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import ImageUpload from "../../components/ImageUpload/ImageUpload";
import { updateUser, getUserData } from "../../utilities/users-api";
import { lang } from "../../lang.constants";
import PageMeta from "../../components/PageMeta/PageMeta";
import { handleError } from "../../utilities/error-handler";
import { Tooltip } from "bootstrap";

export default function UpdateProfile({ user, setUser, updateData }) {
  const [formData, setFormData] = useState(user);
  const [originalUser] = useState(user);
  const [changes, setChanges] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState("");
  const navigate = useNavigate();

  // Fetch full user data including photos on component mount
  useEffect(() => {
    async function fetchUserData() {
      try {
        const fullUserData = await getUserData(user._id);
        setFormData(fullUserData);
        setLoading(false);
      } catch (err) {
        const errorMsg = handleError(err, { context: 'Load user data' });
        setError(errorMsg || 'Failed to load user data');
        setLoading(false);
      }
    }
    
    fetchUserData();
  }, [user._id]);

  // Initialize Bootstrap tooltips
  useEffect(() => {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new Tooltip(tooltipTriggerEl));
    
    return () => {
      tooltipList.forEach(tooltip => tooltip.dispose());
    };
  }, [loading]);

  // Convert snake_case to Title Case
  function formatFieldName(fieldName) {
    return fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  function handleChange(e) {
    const { name, value } = e.target;
    const updatedFormData = { ...formData, [name]: value };

    // Track changes
    const newChanges = { ...changes };
    if (originalUser && originalUser[name] !== value) {
      newChanges[name] = { from: originalUser[name], to: value };
    } else {
      delete newChanges[name];
    }

    setFormData(updatedFormData);
    setChanges(newChanges);
  }

  function handlePasswordChange(e) {
    const { name, value } = e.target;
    const updatedPasswordData = { ...passwordData, [name]: value };
    setPasswordData(updatedPasswordData);
    setPasswordError("");

    // Validate passwords on change
    if (name === 'confirmPassword' || name === 'newPassword') {
      if (updatedPasswordData.newPassword && updatedPasswordData.confirmPassword) {
        if (updatedPasswordData.newPassword !== updatedPasswordData.confirmPassword) {
          setPasswordError("New passwords do not match");
        }
      }
    }

    // Track password change
    if (updatedPasswordData.oldPassword && updatedPasswordData.newPassword && updatedPasswordData.confirmPassword) {
      if (updatedPasswordData.newPassword === updatedPasswordData.confirmPassword) {
        const newChanges = { ...changes };
        newChanges.password = { from: '********', to: '********' };
        setChanges(newChanges);
      }
    } else {
      const newChanges = { ...changes };
      delete newChanges.password;
      setChanges(newChanges);
    }
  }

  // Track photo changes
  useEffect(() => {
    if (!formData || !originalUser) return;

    const newChanges = { ...changes };
    
    // Check if photos array changed
    const originalPhotos = originalUser.photos || [];
    const currentPhotos = formData.photos || [];
    
    const photosChanged = JSON.stringify(originalPhotos) !== JSON.stringify(currentPhotos);
    
    if (photosChanged) {
      const fromText = originalPhotos.length === 0 ? 'No photos' : `${originalPhotos.length} photo${originalPhotos.length > 1 ? 's' : ''}`;
      const toText = currentPhotos.length === 0 ? 'No photos' : `${currentPhotos.length} photo${currentPhotos.length > 1 ? 's' : ''}`;
      
      newChanges.photos = {
        from: fromText,
        to: toText
      };
    } else {
      delete newChanges.photos;
    }
    
    // Check if default photo index changed
    const originalIndex = originalUser.default_photo_index || 0;
    const currentIndex = formData.default_photo_index || 0;
    
    if (originalIndex !== currentIndex && currentPhotos.length > 0) {
      newChanges.default_photo_index = {
        from: `Photo #${originalIndex + 1}`,
        to: `Photo #${currentIndex + 1}`
      };
    } else {
      delete newChanges.default_photo_index;
    }
    
    // Only update if changes actually differ
    if (JSON.stringify(newChanges) !== JSON.stringify(changes)) {
      setChanges(newChanges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, originalUser]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setPasswordError("");

    if (Object.keys(changes).length === 0 && !formData.photos) {
      setError("No changes detected.");
      return;
    }

    // Validate password fields if any password field is filled
    if (passwordData.oldPassword || passwordData.newPassword || passwordData.confirmPassword) {
      if (!passwordData.oldPassword) {
        setPasswordError("Old password is required to change password");
        return;
      }
      if (!passwordData.newPassword) {
        setPasswordError("New password is required");
        return;
      }
      if (!passwordData.confirmPassword) {
        setPasswordError("Please confirm your new password");
        return;
      }
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setPasswordError("New passwords do not match");
        return;
      }
      if (passwordData.newPassword.length < 3) {
        setPasswordError("New password must be at least 3 characters");
        return;
      }
    }

    try {
      const dataToUpdate = { ...formData };
      
      // Add password data if passwords are being changed
      if (passwordData.oldPassword && passwordData.newPassword) {
        dataToUpdate.oldPassword = passwordData.oldPassword;
        dataToUpdate.password = passwordData.newPassword;
      }

      let updatedUser = await updateUser(user._id, dataToUpdate);
      setUser(updatedUser);
      updateData && updateData();
      navigate('/profile');
    } catch (err) {
      const errorMsg = handleError(err, { context: 'Update profile' });
      setError(errorMsg || 'Failed to update profile. Please try again.');
    }
  }

  function handleConfirmUpdate() {
    setShowConfirmModal(true);
  }

  async function confirmUpdate() {
    setShowConfirmModal(false);
    await handleSubmit({ preventDefault: () => {} });
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

      <div className="row fade-in">
        <div className="col-md-6 fade-in">
          <h1 className="my-4 h fade-in">{lang.en.heading.updateProfile.replace('{name}', user.name)}</h1>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger mb-4" role="alert">
          {error}
        </div>
      )}

      {Object.keys(changes).length > 0 && (
        <div className="alert alert-info mb-4" role="alert">
          <strong>Changes detected:</strong>
          <ul className="mb-0 mt-2">
            {Object.keys(changes).map((field, idx) => (
              <li key={idx}>
                <strong>{formatFieldName(field)}:</strong> {changes[field].from || '(empty)'} → {changes[field].to || '(empty)'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <div className="text-center my-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading user data...</span>
          </div>
          <p className="mt-3">Loading your profile...</p>
        </div>
      ) : (
        <div className="row my-4 fade-in">
          <div className="col-12">
            <form className="updateProfile" autoComplete="off" onSubmit={handleSubmit} style={{ display: 'block' }}>
            <div className="mb-4">
              <label htmlFor="name" className="form-label">
                Name
                <span 
                  className="ms-2 text-info" 
                  data-bs-toggle="tooltip" 
                  data-bs-placement="top" 
                  title={lang.en.helper.profileName}
                  style={{ cursor: 'help' }}
                >
                  ℹ️
                </span>
              </label>
              <input
                type="text"
                name="name"
                id="name"
                className="form-control"
                placeholder={lang.en.placeholder.nameField}
                onChange={handleChange}
                value={formData.name}
                required
              />
            </div>

            <div className="mb-4">
              <label htmlFor="email" className="form-label">
                Email Address
                <span 
                  className="ms-2 text-info" 
                  data-bs-toggle="tooltip" 
                  data-bs-placement="top" 
                  title={lang.en.helper.profileEmail}
                  style={{ cursor: 'help' }}
                >
                  ℹ️
                </span>
              </label>
              <input
                type="email"
                name="email"
                id="email"
                className="form-control"
                placeholder={lang.en.placeholder.emailField}
                onChange={handleChange}
                value={formData.email}
                required
              />
            </div>

            <div className="mb-4">
              <h5 className="mb-3">Change Password (Optional)</h5>
              {passwordError && (
                <div className="alert alert-danger" role="alert">
                  {passwordError}
                </div>
              )}
              
              <div className="mb-3">
                <label htmlFor="oldPassword" className="form-label">
                  Current Password
                  <span 
                    className="ms-2 text-info" 
                    data-bs-toggle="tooltip" 
                    data-bs-placement="top" 
                    title={lang.en.helper.currentPassword}
                    style={{ cursor: 'help' }}
                  >
                    ℹ️
                  </span>
                </label>
                <input
                  type="password"
                  name="oldPassword"
                  id="oldPassword"
                  className="form-control"
                  placeholder="Enter your current password"
                  onChange={handlePasswordChange}
                  value={passwordData.oldPassword}
                  autoComplete="current-password"
                />
              </div>

              <div className="mb-3">
                <label htmlFor="newPassword" className="form-label">
                  New Password
                  <span 
                    className="ms-2 text-info" 
                    data-bs-toggle="tooltip" 
                    data-bs-placement="top" 
                    title={lang.en.helper.newPassword}
                    style={{ cursor: 'help' }}
                  >
                    ℹ️
                  </span>
                </label>
                <input
                  type="password"
                  name="newPassword"
                  id="newPassword"
                  className="form-control"
                  placeholder="Enter your new password"
                  onChange={handlePasswordChange}
                  value={passwordData.newPassword}
                  autoComplete="new-password"
                  minLength={3}
                />
              </div>

              <div className="mb-3">
                <label htmlFor="confirmPassword" className="form-label">
                  Confirm New Password
                  <span 
                    className="ms-2 text-info" 
                    data-bs-toggle="tooltip" 
                    data-bs-placement="top" 
                    title={lang.en.helper.confirmPassword}
                    style={{ cursor: 'help' }}
                  >
                    ℹ️
                  </span>
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  id="confirmPassword"
                  className="form-control"
                  placeholder="Confirm your new password"
                  onChange={handlePasswordChange}
                  value={passwordData.confirmPassword}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label">
                Profile Photo
                <span 
                  className="ms-2 text-info" 
                  data-bs-toggle="tooltip" 
                  data-bs-placement="top" 
                  title={lang.en.helper.profilePhoto}
                  style={{ cursor: 'help' }}
                >
                  ℹ️
                </span>
              </label>
              <ImageUpload data={formData} setData={setFormData} />
            </div>

            <div className="d-flex justify-content-between mt-4 gap-3">
              <Link
                to="/profile"
                className="btn btn-secondary btn-lg"
                aria-label={lang.en.button.cancel}
              >
                {lang.en.button.cancel}
              </Link>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={handleConfirmUpdate}
                disabled={Object.keys(changes).length === 0}
                aria-label={lang.en.button.confirmUpdate || 'Confirm Update'}
                aria-disabled={Object.keys(changes).length === 0}
              >
                {lang.en.button.confirmUpdate || 'Confirm Update'}
              </button>
            </div>
          </form>
        </div>
      </div>
      )}

      {showConfirmModal && (
        <div className="modal fade show d-block" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{lang.en.modal.confirmProfileUpdate || 'Confirm Profile Update'}</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowConfirmModal(false)}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body">
                <p>{lang.en.modal.confirmUpdateReview || 'Please review your changes before updating:'}</p>
                <ul className="list-group">
                  {Object.entries(changes).map(([field, change]) => (
                    <li key={field} className="list-group-item">
                      <strong>{formatFieldName(field)}:</strong>{' '}
                      {typeof change.from === 'object' ? JSON.stringify(change.from) : (change.from || 'None')}{' '}
                      →{' '}
                      {typeof change.to === 'object' ? JSON.stringify(change.to) : (change.to || 'None')}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowConfirmModal(false)}
                  aria-label={lang.en.button.cancel}
                >
                  {lang.en.button.cancel}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={confirmUpdate}
                  aria-label={lang.en.button.update || 'Update Profile'}
                >
                  {lang.en.button.update || 'Update Profile'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
