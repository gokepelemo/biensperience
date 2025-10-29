import "./Profile.css";
import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ImageUpload from "../../components/ImageUpload/ImageUpload";
import Alert from "../../components/Alert/Alert";
import { updateUser as updateUserAPI, updateUserAsAdmin, getUserData } from "../../utilities/users-api";
import { updateToken } from "../../utilities/users-service";
import { useUser } from "../../contexts/UserContext";
import { useToast } from "../../contexts/ToastContext";
import { lang } from "../../lang.constants";
import PageMeta from "../../components/PageMeta/PageMeta";
import { handleError } from "../../utilities/error-handler";
import { formatChanges } from "../../utilities/change-formatter";
import FormField from "../../components/FormField/FormField";
import { FormTooltip } from "../../components/Tooltip/Tooltip";
import { Form } from "react-bootstrap";
import { isSuperAdmin } from "../../utilities/permissions";

export default function UpdateProfile() {
  const { user, updateUser: updateUserContext, fetchProfile } = useUser();
  const { success, error: showError } = useToast();
  const [targetUser, setTargetUser] = useState(null);
  const [formData, setFormData] = useState({});
  const [originalUser, setOriginalUser] = useState(null);
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
  const { userId } = useParams();

  // Determine if this is admin mode (editing another user)
  const isAdminMode = !!userId && userId !== user._id;
  const currentUser = isAdminMode ? targetUser : user;
  const isEditingSelf = !isAdminMode;

  // Check admin permissions for admin mode
  useEffect(() => {
    if (isAdminMode && !isSuperAdmin(user)) {
      navigate('/profile');
      return;
    }
  }, [user, isAdminMode, navigate]);

  // Fetch user data (self or target user)
  useEffect(() => {
    async function fetchUserData() {
      try {
        let userData;
        if (isAdminMode) {
          // Admin mode: fetch target user data
          userData = await getUserData(userId);
          setTargetUser(userData);
        } else {
          // Self mode: fetch current user data
          await fetchProfile();
          userData = user;
        }

        setOriginalUser(userData);
        setFormData(userData);
        setLoading(false);
      } catch (err) {
        const errorMsg = handleError(err, { context: isAdminMode ? 'Load user data' : 'Load profile data' });
        setError(errorMsg || 'Failed to load user data');
        setLoading(false);
      }
    }

    if (user) {
      fetchUserData();
    }
  }, [user, userId, isAdminMode, fetchProfile]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    const fieldValue = type === 'checkbox' ? checked : value;
    const updatedFormData = { ...formData, [name]: fieldValue };

    // Track changes
    const newChanges = { ...changes };
    if (originalUser && originalUser[name] !== fieldValue) {
      newChanges[name] = { from: originalUser[name], to: fieldValue };
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
      if (isEditingSelf && !passwordData.oldPassword) {
        setPasswordError("Old password is required to change password");
        return;
      }
      if (!passwordData.newPassword) {
        setPasswordError(isEditingSelf ? "New password is required" : "Password is required");
        return;
      }
      if (!passwordData.confirmPassword) {
        setPasswordError(isEditingSelf ? "Please confirm your new password" : "Please confirm the password");
        return;
      }
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setPasswordError(isEditingSelf ? "New passwords do not match" : "Passwords do not match");
        return;
      }
      if (passwordData.newPassword.length < 3) {
        setPasswordError("Password must be at least 3 characters");
        return;
      }
    }

    try {
      const dataToUpdate = { ...formData };

      // Add password data
      if (passwordData.newPassword) {
        if (isEditingSelf) {
          // Self-editing: require old password
          dataToUpdate.oldPassword = passwordData.oldPassword;
        }
        // Both modes: set new password
        dataToUpdate.password = passwordData.newPassword;
      }

      let response;
      if (isAdminMode) {
        // Admin mode: use admin API
        response = await updateUserAsAdmin(userId, dataToUpdate);
        success('User profile updated successfully!');
        navigate(`/profile/${userId}`);
      } else {
        // Self mode: use regular API
        response = await updateUserAPI(user._id, dataToUpdate);

        // Handle both old format (just user) and new format ({ user, token })
        const updatedUser = response.user || response;
        const token = response.token;

        // Update token in localStorage if provided
        if (token) {
          updateToken(token);
        }

        updateUserContext(updatedUser); // Instant UI update!
        success('Profile updated!');
        navigate('/profile');
      }
    } catch (err) {
      const errorMsg = handleError(err, { context: isAdminMode ? 'Update user profile' : 'Update profile' });
      setError(errorMsg || 'Failed to update profile. Please try again.');
      showError(errorMsg);
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
        title={isAdminMode ? `Edit User - ${currentUser?.name}` : `Edit Profile - ${user.name}`}
        description={isAdminMode ? 
          `Admin: Update user profile settings, change name, email, and account settings.` :
          `Update your Biensperience profile settings, change your name, email, and profile photo. Manage your travel planning account.`
        }
        keywords="edit profile, update profile, account settings, profile photo, user settings"
        ogTitle={isAdminMode ? `Edit User - ${currentUser?.name}` : `Edit Profile - ${user.name}`}
        ogDescription={isAdminMode ? 
          "Admin: Update user profile and account settings" :
          "Update your Biensperience profile and account settings"
        }
      />

      <div className="row fade-in">
        <div className="col-md-12 fade-in">
          <h1 className="my-4 h fade-in text-center">
            {isAdminMode ?
              `Edit User Profile: ${currentUser?.name} (${currentUser?.email})` :
              `Update Your Profile: ${user.name}`
            }
          </h1>
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
              <li key={idx} style={{ whiteSpace: 'pre-line' }}>
                {formatChanges(field, changes[field], 'profile')}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {isAdminMode && !isSuperAdmin(user) ? (
        <div className="container mt-4">
          <Alert type="danger" message="Access denied. Super admin privileges required." />
        </div>
      ) : loading ? (
        <div className="text-center my-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading user data...</span>
          </div>
          <p className="mt-3">Loading {isAdminMode ? 'user' : 'your'} profile...</p>
        </div>
      ) : (
        <div className="row my-4 fade-in justify-content-center">
          <div className="col-md-8 col-lg-6">
            <Form className="update-profile-form" autoComplete="off" onSubmit={handleSubmit} style={{ display: 'block' }}>
            <FormField
              name="name"
              label="Name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              placeholder={lang.en.placeholder.nameField}
              required
              autoComplete="name"
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
              autoComplete="email"
              tooltip={lang.en.helper.profileEmail}
              tooltipPlacement="top"
            />

            {isSuperAdmin(user) && (
              <Form.Group className="mb-4" controlId="emailConfirmed">
                <Form.Check
                  type="checkbox"
                  id="emailConfirmed"
                  name="emailConfirmed"
                  label={
                    <>
                      Email Confirmed <span className="text-warning" title="Super Admin Only">🔐</span>
                    </>
                  }
                  checked={formData.emailConfirmed || false}
                  onChange={handleChange}
                />
                <Form.Text className="text-muted">
                  Manually confirm or unconfirm this user's email address.
                </Form.Text>
              </Form.Group>
            )}

            <div className="mb-4">
              <h5 className="mb-3">Change Password (Optional)</h5>
              {passwordError && (
                <Alert
                  type="danger"
                  message={passwordError}
                />
              )}
              
              {isEditingSelf && (
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
              )}

              <FormField
                name="newPassword"
                label={isEditingSelf ? "New Password" : "Password"}
                type="password"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                placeholder={isEditingSelf ? "Enter your new password" : "Enter password"}
                autoComplete="new-password"
                minLength={3}
                tooltip={isEditingSelf ? lang.en.helper.newPassword : "Set a new password for this user"}
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
                to={isAdminMode ? `/profile/${userId}` : "/profile"}
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
                      <div style={{ whiteSpace: 'pre-line' }}>
                        {formatChanges(field, change, 'profile')}
                      </div>
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
