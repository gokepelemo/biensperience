import "./Profile.css";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import ImageUpload from "../../components/ImageUpload/ImageUpload";
import Alert from "../../components/Alert/Alert";
import { updateUser, getUserData } from "../../utilities/users-api";
import { lang } from "../../lang.constants";
import PageMeta from "../../components/PageMeta/PageMeta";
import { handleError } from "../../utilities/error-handler";
import FormField from "../../components/FormField/FormField";
import { FormTooltip } from "../../components/Tooltip/Tooltip";
import { Form } from "react-bootstrap";

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
        <Alert
          type="danger"
          message={error}
          className="mb-4"
        />
      )}

      {Object.keys(changes).length > 0 && (
        <Alert
          type="info"
          className="mb-4"
        >
          <strong>Changes detected:</strong>
          <ul className="mb-0 mt-2">
            {Object.keys(changes).map((field, idx) => (
              <li key={idx}>
                <strong>{formatFieldName(field)}:</strong> {changes[field].from || '(empty)'} → {changes[field].to || '(empty)'}
              </li>
            ))}
          </ul>
        </Alert>
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
            <Form className="updateProfile" autoComplete="off" onSubmit={handleSubmit} style={{ display: 'block' }}>
            <FormField
              name="name"
              label="Name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              placeholder={lang.en.placeholder.nameField}
              required
              tooltip={lang.en.helper.profileName}
              tooltipPlacement="top"
            />

            <FormField
              name="email"
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder={lang.en.placeholder.emailField}
              required
              tooltip={lang.en.helper.profileEmail}
              tooltipPlacement="top"
            />

            <div className="mb-4">
              <h5 className="mb-3">Change Password (Optional)</h5>
              {passwordError && (
                <Alert
                  type="danger"
                  message={passwordError}
                />
              )}
              
              <FormField
                name="oldPassword"
                label="Current Password"
                type="password"
                value={passwordData.oldPassword}
                onChange={handlePasswordChange}
                placeholder="Enter your current password"
                autoComplete="current-password"
                tooltip={lang.en.helper.currentPassword}
                tooltipPlacement="top"
                className="mb-3"
              />

              <FormField
                name="newPassword"
                label="New Password"
                type="password"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                placeholder="Enter your new password"
                autoComplete="new-password"
                minLength={3}
                tooltip={lang.en.helper.newPassword}
                tooltipPlacement="top"
                className="mb-3"
              />

              <FormField
                name="confirmPassword"
                label="Confirm New Password"
                type="password"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                placeholder="Confirm your new password"
                autoComplete="new-password"
                tooltip={lang.en.helper.confirmPassword}
                tooltipPlacement="top"
                className="mb-3"
              />
            </div>

            <div className="mb-4">
              <Form.Label>
                Profile Photo
                <FormTooltip 
                  content={lang.en.helper.profilePhoto}
                  placement="top"
                />
              </Form.Label>
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
          </Form>
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
