import styles from "./Profile.module.scss";
import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ImageUpload from "../../components/ImageUpload/ImageUpload";
import Alert from "../../components/Alert/Alert";
import Loading from "../../components/Loading/Loading";
import { updateUser as updateUserAPI, updateUserAsAdmin, getUserData } from "../../utilities/users-api";
import { updateToken } from "../../utilities/users-service";
import { useUser } from "../../contexts/UserContext";
import { useToast } from "../../contexts/ToastContext";
import { lang } from "../../lang.constants";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import { handleError } from "../../utilities/error-handler";
import { formatChanges } from "../../utilities/change-formatter";
import FormField from "../../components/FormField/FormField";
import { FormTooltip } from "../../components/Tooltip/Tooltip";
import { Form } from "react-bootstrap";
import { isSuperAdmin } from "../../utilities/permissions";

export default function UpdateProfile() {
  const { user, profile, updateUser: updateUserContext, fetchProfile } = useUser();
  const { success, error: showError } = useToast();
  const [targetUser, setTargetUser] = useState(null);
  const [formData, setFormData] = useState({});
  const [originalUser, setOriginalUser] = useState(null);
  const [changes, setChanges] = useState({});
  // Prevent initial-load dirty-state flicker by deferring change banners
  const [isInitialLoad, setIsInitialLoad] = useState(true);
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
          // Self mode: use profile data if available, otherwise fetch it
          if (!profile) {
            await fetchProfile();
          }
          userData = profile || user;
        }

        // Deep clone to ensure originalUser and formData are independent
        const clonedUserData = JSON.parse(JSON.stringify(userData));
        // Normalize photos to IDs for consistent comparison (if ImageUpload is used)
        if (clonedUserData.photos) {
          clonedUserData.photos = clonedUserData.photos.map(photo => 
            photo._id ? photo._id : photo
          );
        }
        setOriginalUser(clonedUserData);
        setFormData(JSON.parse(JSON.stringify(userData)));
  setLoading(false);
  // Mark initial load complete on next tick to allow state to settle
  setTimeout(() => setIsInitialLoad(false), 0);
      } catch (err) {
          const errorMsg = handleError(err, { context: isAdminMode ? 'Load user data' : 'Load profile data' });
          setError(errorMsg || lang.current.alert.failedToLoadProfile);
        setLoading(false);
      }
    }

    if (user) {
      fetchUserData();
    }
  }, [user, profile, userId, isAdminMode, fetchProfile]);

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

  // Track photo/default photo changes
  useEffect(() => {
    if (!formData || !originalUser || isInitialLoad) return;

    const newChanges = { ...changes };
    
    // Check if photos array changed
    const originalPhotos = originalUser.photos || [];
    const currentPhotos = formData.photos || [];
    
    // Normalize for comparison: extract _ids from objects, keep ObjectIds as strings
    const normalizePhotos = (photos) => {
      return photos.map(photo => {
        if (typeof photo === 'string') return photo;
        if (photo._id) return photo._id.toString();
        return photo.toString();
      }).sort();
    };
    
    const originalPhotoIds = normalizePhotos(originalPhotos);
    const currentPhotoIds = normalizePhotos(currentPhotos);
    
    const photosChanged = JSON.stringify(originalPhotoIds) !== JSON.stringify(currentPhotoIds);
    
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
    
    // Check if default photo changed
    const originalDefaultId = originalUser.default_photo_id;
    const currentDefaultId = formData.default_photo_id;
    
    // Normalize default photo IDs for comparison
    const normalizeId = (id) => {
      if (!id) return null;
      if (typeof id === 'string') return id;
      if (id._id) return id._id.toString();
      return id.toString();
    };
    
    // If original had no default_photo_id but had photos, treat first photo as the implicit default
    let normalizedOriginalDefault = normalizeId(originalDefaultId);
    if (!normalizedOriginalDefault && originalPhotos.length > 0) {
      normalizedOriginalDefault = normalizeId(originalPhotos[0]);
    }
    
    let normalizedCurrentDefault = normalizeId(currentDefaultId);
    // Treat first photo as implicit default when current default is not set but photos exist
    if (!normalizedCurrentDefault && currentPhotos.length > 0) {
      normalizedCurrentDefault = normalizeId(currentPhotos[0]);
    }

    if (normalizedOriginalDefault !== normalizedCurrentDefault && currentPhotos.length > 0) {
      // Find the index of the default photo for description
      const getPhotoIndex = (photoId, photoArray) => {
        if (!photoId) return -1;
        const normalizedId = normalizeId(photoId);
        return photoArray.findIndex(p => normalizeId(p) === normalizedId);
      };
      
      const originalIndex = getPhotoIndex(originalDefaultId, originalPhotos);
      const currentIndex = getPhotoIndex(currentDefaultId, currentPhotos);
      
      newChanges.default_photo = {
        from: originalIndex >= 0 ? `Photo ${originalIndex + 1}` : 'None',
        to: currentIndex >= 0 ? `Photo ${currentIndex + 1}` : 'None'
      };
    } else {
      delete newChanges.default_photo;
    }
    
    // Only update if changes actually differ
    if (JSON.stringify(newChanges) !== JSON.stringify(changes)) {
      setChanges(newChanges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, originalUser, isInitialLoad]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setPasswordError("");

    if (Object.keys(changes).length === 0 && !formData.photos) {
      setError(lang.current.alert.noChangesDetected);
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
      // Only include fields that have actually changed
      const dataToUpdate = {};

      // Add changed form fields (excluding password which is handled separately)
      Object.keys(changes).forEach(field => {
        if (field !== 'password' && changes[field]) {
          // Map display key to actual model field name
          const actualFieldName = field === 'default_photo' ? 'default_photo_id' : field;
          // For location, send the query string for backend geocoding
          if (field === 'location') {
            dataToUpdate.location = formData.locationQuery || '';
          } else {
            dataToUpdate[actualFieldName] = formData[actualFieldName] || formData[field];
          }
        }
      });

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
        success(lang.current.notification?.profile?.updated || "Your profile has been updated. Changes are now visible to others.");
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
        success(lang.current.notification?.profile?.updated || "Your profile has been updated. Changes are now visible to others.");
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
      <PageOpenGraph
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

      <div className="row animation-fade-in">
        <div className="col-12">
          <h1 className="form-title">
            {isAdminMode ?
              `Edit User Profile: ${currentUser?.name} (${currentUser?.email})` :
              "Update Your Profile"
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

      {!loading && !isInitialLoad && Object.keys(changes).length > 0 && (
        <Alert
          type="info"
          className="mb-4"
        >
          <strong>Changes detected:</strong>
          <ul className="mb-0 mt-2">
            {Object.keys(changes).map((field, idx) => (
              <li key={idx} className="whitespace-pre-line">
                {formatChanges(field, changes[field], 'profile')}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {isAdminMode && !isSuperAdmin(user) ? (
        <div className="container mt-4">
          <Alert type="danger" message={lang.current.alert.accessDeniedAction} />
        </div>
      ) : loading ? (
        <Loading variant="centered" size="lg" message={lang.current.alert.loadingProfile} />
      ) : (
        <div className="row my-4 animation-fade-in justify-content-center">
          <div className="col-12">
            <Form className="form-unified" autoComplete="off" onSubmit={handleSubmit}>
            <FormField
              name="name"
              label="Name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              placeholder={lang.current.placeholder.nameField}
              required
              autoComplete="name"
              tooltip={lang.current.helper.profileName}
              tooltipPlacement="top"
            />

            <FormField
              name="email"
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder={lang.current.placeholder.emailField}
              required
              autoComplete="email"
              tooltip={lang.current.helper.profileEmail}
              tooltipPlacement="top"
            />

            <FormField
              name="location"
              label="Location"
              type="text"
              value={formData.location?.displayName || formData.locationQuery || ''}
              onChange={(e) => {
                // Store the query string for geocoding on submit
                setFormData(prev => ({
                  ...prev,
                  locationQuery: e.target.value
                }));
                // Track changes
                const originalLocation = originalUser?.location?.displayName || '';
                const newLocation = e.target.value;
                if (originalLocation !== newLocation) {
                  setChanges(prev => ({
                    ...prev,
                    location: { from: originalLocation || 'Not set', to: newLocation || 'Not set' }
                  }));
                } else {
                  setChanges(prev => {
                    const newChanges = { ...prev };
                    delete newChanges.location;
                    return newChanges;
                  });
                }
              }}
              placeholder="Enter city, zip code, or address"
              autoComplete="address-level2"
              tooltip="Enter a city name, zip/postal code, or full address. We'll look up the location to show your city and country on your profile."
              tooltipPlacement="top"
            />
            {formData.location?.city && formData.location?.country && !formData.locationQuery && (
              <p className="text-muted small mt-n2 mb-3">
                📍 Current location: {formData.location.city}{formData.location.state ? `, ${formData.location.state}` : ''}, {formData.location.country}
              </p>
            )}

            {isSuperAdmin(user) && (
              <Form.Group className="mb-3">
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
                  className="normalize-checkbox"
                />
                <Form.Text style={{ color: 'var(--bs-gray-600)' }}>
                  Manually confirm or unconfirm this user's email address.
                </Form.Text>
              </Form.Group>
            )}

            <div className="mb-4">
              <h5 className="form-section-header">Change Password (Optional)</h5>
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
                  placeholder={lang.current.placeholder.enterCurrentPassword}
                  autoComplete="current-password"
                  tooltip={lang.current.helper.currentPassword}
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
                tooltip={isEditingSelf ? lang.current.helper.newPassword : "Set a new password for this user"}
                tooltipPlacement="top"
                className="mb-3"
              />

              <FormField
                name="confirmPassword"
                label="Confirm New Password"
                type="password"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                placeholder={lang.current.placeholder.confirmNewPassword}
                autoComplete="new-password"
                tooltip={lang.current.helper.confirmPassword}
                tooltipPlacement="top"
                className="mb-3"
              />
            </div>

            <div className="mb-4">
              <h5 className="form-section-header">
                Profile Photo
                <FormTooltip 
                  content={lang.current.helper.profilePhoto}
                  placement="top"
                />
              </h5>
              <ImageUpload data={formData} setData={setFormData} />
            </div>

            <div className="d-flex justify-content-between mt-4 gap-3">
              <Link
                to={isAdminMode ? `/profile/${userId}` : "/profile"}
                className="btn btn-secondary btn-lg"
                aria-label={lang.current.button.cancel}
              >
                {lang.current.button.cancel}
              </Link>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={handleConfirmUpdate}
                disabled={Object.keys(changes).length === 0}
                aria-label={lang.current.button.confirmUpdate || 'Confirm Update'}
                aria-disabled={Object.keys(changes).length === 0}
              >
                {lang.current.button.confirmUpdate || 'Confirm Update'}
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
                <h5 className="modal-title">{lang.current.modal.confirmProfileUpdate || 'Confirm Profile Update'}</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowConfirmModal(false)}
                  aria-label="Close"
                >
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>
              <div className="modal-body">
                <p>{lang.current.modal.confirmUpdateReview || 'Please review your changes before updating:'}</p>
                <ul className="list-group">
                  {Object.entries(changes).map(([field, change]) => (
                    <li key={field} className="list-group-item">
                      <div className="whitespace-pre-line">
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
                  aria-label={lang.current.button.cancel}
                >
                  {lang.current.button.cancel}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={confirmUpdate}
                  aria-label={lang.current.button.update || 'Update Profile'}
                >
                  {lang.current.button.update || 'Update Profile'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
