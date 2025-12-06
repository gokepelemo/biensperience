import styles from "./Profile.module.scss";
import { useState, useEffect } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { FaCrosshairs, FaPlus, FaTimes, FaStar, FaGlobe, FaExternalLinkAlt, FaFlag, FaLink, FaUser, FaCamera, FaUserShield, FaCheckCircle, FaTrash } from "react-icons/fa";
import { getSocialNetworkOptions, getSocialNetwork, buildLinkUrl, getLinkIcon } from "../../utilities/social-links";
import PhotoUpload from "../../components/PhotoUpload/PhotoUpload";
import Alert from "../../components/Alert/Alert";
import Loading from "../../components/Loading/Loading";
import { updateUser as updateUserAPI, updateUserAsAdmin, getUserData } from "../../utilities/users-api";
import { updateToken, logout } from "../../utilities/users-service";
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
import { reverseGeocode } from "../../utilities/address-utils";
import { Button } from "../../components/design-system";
import { hasFeatureFlag, FEATURE_FLAGS } from "../../utilities/feature-flags";
import Autocomplete from "../../components/Autocomplete/Autocomplete";
import Checkbox from "../../components/Checkbox/Checkbox";
import DeleteAccountModal from "../../components/DeleteAccountModal/DeleteAccountModal";
import { logger } from "../../utilities/logger";

// Demo mode detection
const isDemoMode = process.env.REACT_APP_DEMO_MODE === 'true';
const DEMO_USER_EMAIL = 'demo@biensperience.com';

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
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [geolocating, setGeolocating] = useState(false);
  const [flagSearchValue, setFlagSearchValue] = useState("");
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
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

  // Handle hash-based URL for delete account modal
  // Track if modal was opened via hash (vs direct button click)
  const [openedViaHash, setOpenedViaHash] = useState(false);

  useEffect(() => {
    const hash = location.hash.toLowerCase();
    if (hash === '#delete-account' || hash === '#delete') {
      logger.debug('[UpdateProfile] Opening delete account modal via hash');
      setShowDeleteAccountModal(true);
      setOpenedViaHash(true);
    } else if (openedViaHash && hash === '') {
      // Only close modal if it was opened via hash and hash is now cleared
      setShowDeleteAccountModal(false);
      setOpenedViaHash(false);
    }
  }, [location.hash, openedViaHash]);

  // Clear hash when delete modal is closed
  const handleDeleteModalClose = () => {
    setShowDeleteAccountModal(false);
    // Only clear hash if it was opened via hash
    if (openedViaHash) {
      setOpenedViaHash(false);
      // Remove hash from URL
      const newUrl = location.pathname + location.search;
      navigate(newUrl, { replace: true });
    }
  };

  // Handle successful account deletion
  const handleDeleteSuccess = async (result) => {
    logger.info('[UpdateProfile] Account deleted successfully', {
      dataTransferred: result.dataTransferred,
      transferredTo: result.transferredTo?.name
    });
    // Log the user out and redirect to login
    await logout();
    navigate('/');
  };

  // Helper to check if a flag is explicitly enabled (bypasses super admin override)
  const hasExplicitFlag = (flagKey) => {
    const flags = formData.feature_flags || [];
    const flag = flags.find(f => f.flag === flagKey.toLowerCase());
    return flag?.enabled || false;
  };

  // Add a new feature flag
  const handleAddFeatureFlag = (flagKey) => {
    const normalizedKey = flagKey.toLowerCase();
    const existingFlags = formData.feature_flags || [];

    // Don't add if already exists
    if (existingFlags.some(f => f.flag === normalizedKey && f.enabled)) {
      return;
    }

    const newFlags = [
      ...existingFlags.filter(f => f.flag !== normalizedKey), // Remove if disabled
      {
        flag: normalizedKey,
        enabled: true,
        granted_at: new Date().toISOString(),
        granted_by: user._id
      }
    ];

    setFormData(prev => ({ ...prev, feature_flags: newFlags }));
    trackFlagChanges(newFlags);
  };

  // Remove a feature flag
  const handleRemoveFeatureFlag = (flagKey) => {
    const normalizedKey = flagKey.toLowerCase();
    const existingFlags = formData.feature_flags || [];

    // Mark as disabled instead of removing (to preserve history)
    const newFlags = existingFlags.map(f =>
      f.flag === normalizedKey ? { ...f, enabled: false } : f
    );

    setFormData(prev => ({ ...prev, feature_flags: newFlags }));
    trackFlagChanges(newFlags);
  };

  // Track feature flag changes
  const trackFlagChanges = (newFlags) => {
    const originalFlags = originalUser?.feature_flags || [];

    // Find added flags (enabled in new, not enabled or missing in original)
    const addedFlags = newFlags
      .filter(f => f.enabled)
      .filter(f => {
        const orig = originalFlags.find(of => of.flag === f.flag);
        return !orig || !orig.enabled;
      })
      .map(f => f.flag);

    // Find removed flags (enabled in original, not enabled or missing in new)
    const removedFlags = originalFlags
      .filter(of => of.enabled)
      .filter(of => {
        const curr = newFlags.find(f => f.flag === of.flag);
        return !curr || !curr.enabled;
      })
      .map(of => of.flag);

    const flagsChanged = addedFlags.length > 0 || removedFlags.length > 0;

    if (flagsChanged) {
      setChanges(prev => ({
        ...prev,
        feature_flags: {
          from: removedFlags.length > 0 ? removedFlags : [],
          to: addedFlags.length > 0 ? addedFlags : [],
          added: addedFlags,
          removed: removedFlags
        }
      }));
    } else {
      setChanges(prev => {
        const { feature_flags, ...rest } = prev;
        return rest;
      });
    }
  };

  // Get available flags (not already added)
  const getAvailableFlags = () => {
    const existingFlags = formData.feature_flags || [];
    const activeFlags = existingFlags.filter(f => f.enabled).map(f => f.flag);
    return Object.values(FEATURE_FLAGS).filter(
      flagDef => !activeFlags.includes(flagDef.key)
    );
  };

  // Get active flags (enabled)
  const getActiveFlags = () => {
    const existingFlags = formData.feature_flags || [];
    return existingFlags
      .filter(f => f.enabled)
      .map(f => {
        const flagDef = Object.values(FEATURE_FLAGS).find(fd => fd.key === f.flag);
        return {
          ...f,
          description: flagDef?.description || f.flag,
          tier: flagDef?.tier || 'custom'
        };
      });
  };

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
        // Normalize photos to IDs for consistent comparison (if PhotoUpload is used)
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

  // Handle "Use Current Location" button
  async function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      showError('Geolocation is not supported by your browser');
      return;
    }

    setGeolocating(true);

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });

      const { latitude, longitude } = position.coords;
      const geocoded = await reverseGeocode(latitude, longitude);

      if (geocoded && geocoded.components) {
        const { city, state, country, countryShort } = geocoded.components;

        // Build location object matching the expected format
        const locationObj = {
          displayName: geocoded.formattedAddress,
          city: city || '',
          state: state || '',
          country: country || '',
          countryCode: countryShort || '',
          coordinates: { lat: latitude, lng: longitude },
          originalQuery: geocoded.formattedAddress,
          geocodedAt: new Date().toISOString()
        };

        // Update form data with geocoded location
        setFormData(prev => ({
          ...prev,
          location: locationObj,
          locationQuery: '' // Clear query since we have a full location object
        }));

        // Track the change
        const originalLocation = originalUser?.location?.displayName || '';
        const newLocation = geocoded.formattedAddress;
        if (originalLocation !== newLocation) {
          setChanges(prev => ({
            ...prev,
            location: { from: originalLocation || 'Not set', to: newLocation }
          }));
        }

        success(`Location set to ${city || geocoded.formattedAddress}`);
      } else {
        showError('Could not determine your location. Please enter it manually.');
      }
    } catch (err) {
      if (err.code === 1) {
        showError('Location access denied. Please enable location permissions in your browser.');
      } else if (err.code === 2) {
        showError('Could not determine your location. Please try again or enter manually.');
      } else if (err.code === 3) {
        showError('Location request timed out. Please try again.');
      } else {
        showError('Failed to get your location. Please enter it manually.');
      }
    } finally {
      setGeolocating(false);
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

              {/* ============================================
                  SECTION 1: Basic Information
                  ============================================ */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionCardHeader}>
                  <h3><FaUser /> Basic Information</h3>
                </div>
                <div className={styles.sectionCardBody}>
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

                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
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
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={handleUseCurrentLocation}
                      disabled={geolocating}
                      title="Use current location"
                      aria-label="Use current location"
                      style={{
                        flexShrink: 0,
                        width: 'clamp(36px, var(--btn-height-md), 44px)',
                        height: 'clamp(36px, var(--btn-height-md), 44px)',
                        minHeight: 'var(--btn-height-md)',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 'var(--space-4)'
                      }}
                    >
                      {geolocating ? (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                      ) : (
                        <FaCrosshairs />
                      )}
                    </Button>
                  </div>
                  {formData.location?.city && formData.location?.country && !formData.locationQuery && (
                    <p className="text-muted small mt-n2 mb-3">
                      📍 Current location: {formData.location.city}{formData.location.state ? `, ${formData.location.state}` : ''}, {formData.location.country}
                    </p>
                  )}

                  {/* Collapsible Change Password Section */}
                  {showPasswordFields ? (
                    <>
                      <h5 className="form-section-header mt-4">Change Password</h5>
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
                    </>
                  ) : (
                    <div className="mt-4">
                      <button
                        className="btn btn-link p-0 text-decoration-none"
                        onClick={() => setShowPasswordFields(true)}
                        type="button"
                        aria-expanded={showPasswordFields}
                      >
                        + Change Password
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ============================================
                  SECTION 2: Profile Photo
                  ============================================ */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionCardHeader}>
                  <h3><FaCamera /> Profile Photo</h3>
                </div>
                <div className={styles.sectionCardBody}>
                  <PhotoUpload data={formData} setData={setFormData} />
                </div>
              </div>

              {/* ============================================
                  SECTION 3: Curator Profile (Only for curators)
                  ============================================ */}
              {hasFeatureFlag(currentUser, 'curator') && (
                <div className={styles.sectionCard}>
                  <div className={styles.sectionCardHeader}>
                    <h3><FaStar /> Curator Profile</h3>
                  </div>
                  <div className={styles.sectionCardBody}>
                    <FormField
                      name="bio"
                      label="Bio"
                      as="textarea"
                      rows={4}
                      value={formData.bio || ''}
                      onChange={handleChange}
                      placeholder="Tell others about yourself, your travel expertise, and what makes your curated experiences special..."
                      maxLength={500}
                      tooltip="A short bio that will be displayed on your profile and curated experiences (max 500 characters)"
                      tooltipPlacement="top"
                      className="mb-3"
                    />

                    <div className="mb-3">
                      <label className="form-label d-flex align-items-center gap-2">
                        <FaLink />
                        Links
                        <FormTooltip
                          content="Add website, social media, or other links to share on your curator profile"
                          placement="top"
                        />
                      </label>

                  {/* Existing links */}
                  {(formData.links || []).map((link, index) => {
                    const network = getSocialNetwork(link.type);
                    const isCustomType = !network || network.isCustomUrl;
                    const LinkIcon = getLinkIcon(link);

                    return (
                      <div key={link._id || index} className={styles.linkEditRow}>
                        {/* Network type dropdown */}
                        <div className={styles.linkTypeSelect}>
                          <select
                            className="form-select"
                            value={link.type || 'custom'}
                            onChange={(e) => {
                              const newType = e.target.value;
                              const selectedNetwork = getSocialNetwork(newType);
                              const newLinks = [...(formData.links || [])];

                              // Reset fields when changing type
                              newLinks[index] = {
                                ...newLinks[index],
                                type: newType,
                                // Clear username/url when switching between custom and social
                                username: selectedNetwork?.isCustomUrl ? '' : (newLinks[index].username || ''),
                                url: selectedNetwork?.isCustomUrl ? (newLinks[index].url || '') : '',
                                title: selectedNetwork?.isCustomUrl ? (newLinks[index].title || '') : selectedNetwork?.name || ''
                              };

                              setFormData(prev => ({ ...prev, links: newLinks }));
                              // Track changes
                              const originalLinks = originalUser?.links || [];
                              const linksChanged = JSON.stringify(originalLinks) !== JSON.stringify(newLinks);
                              if (linksChanged) {
                                setChanges(prev => ({ ...prev, links: { from: originalLinks, to: newLinks } }));
                              } else {
                                setChanges(prev => {
                                  const { links, ...rest } = prev;
                                  return rest;
                                });
                              }
                            }}
                          >
                            {getSocialNetworkOptions().map(opt => {
                              const OptIcon = opt.icon;
                              return (
                                <option key={opt.id} value={opt.id}>
                                  {opt.name}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* Icon preview */}
                        <div className={styles.linkIconPreview} style={{ color: network?.color || '#718096' }}>
                          <LinkIcon size={18} />
                        </div>

                        {/* Input field - username for social, title+url for custom */}
                        <div className={styles.linkInputGroup}>
                          {isCustomType ? (
                            // Custom link: title + URL
                            <>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Link title"
                                value={link.title || ''}
                                onChange={(e) => {
                                  const newLinks = [...(formData.links || [])];
                                  newLinks[index] = { ...newLinks[index], title: e.target.value };
                                  setFormData(prev => ({ ...prev, links: newLinks }));
                                  const originalLinks = originalUser?.links || [];
                                  const linksChanged = JSON.stringify(originalLinks) !== JSON.stringify(newLinks);
                                  if (linksChanged) {
                                    setChanges(prev => ({ ...prev, links: { from: originalLinks, to: newLinks } }));
                                  } else {
                                    setChanges(prev => {
                                      const { links, ...rest } = prev;
                                      return rest;
                                    });
                                  }
                                }}
                                style={{ maxWidth: '150px' }}
                              />
                              <input
                                type="url"
                                className="form-control flex-grow-1"
                                placeholder={network?.placeholder || 'https://example.com'}
                                value={link.url || ''}
                                onChange={(e) => {
                                  const newLinks = [...(formData.links || [])];
                                  newLinks[index] = { ...newLinks[index], url: e.target.value };
                                  setFormData(prev => ({ ...prev, links: newLinks }));
                                  const originalLinks = originalUser?.links || [];
                                  const linksChanged = JSON.stringify(originalLinks) !== JSON.stringify(newLinks);
                                  if (linksChanged) {
                                    setChanges(prev => ({ ...prev, links: { from: originalLinks, to: newLinks } }));
                                  } else {
                                    setChanges(prev => {
                                      const { links, ...rest } = prev;
                                      return rest;
                                    });
                                  }
                                }}
                              />
                            </>
                          ) : (
                            // Social network: username only
                            <input
                              type="text"
                              className="form-control flex-grow-1"
                              placeholder={network?.placeholder || 'username'}
                              value={link.username || ''}
                              onChange={(e) => {
                                const newLinks = [...(formData.links || [])];
                                const username = e.target.value.replace(/^@/, ''); // Strip @ if user types it
                                newLinks[index] = {
                                  ...newLinks[index],
                                  username,
                                  // Auto-generate URL from username
                                  url: username ? network.urlPattern(username) : '',
                                  title: network.name
                                };
                                setFormData(prev => ({ ...prev, links: newLinks }));
                                const originalLinks = originalUser?.links || [];
                                const linksChanged = JSON.stringify(originalLinks) !== JSON.stringify(newLinks);
                                if (linksChanged) {
                                  setChanges(prev => ({ ...prev, links: { from: originalLinks, to: newLinks } }));
                                } else {
                                  setChanges(prev => {
                                    const { links, ...rest } = prev;
                                    return rest;
                                  });
                                }
                              }}
                            />
                          )}
                        </div>

                        {/* Remove button */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newLinks = (formData.links || []).filter((_, i) => i !== index);
                            setFormData(prev => ({ ...prev, links: newLinks }));
                            const originalLinks = originalUser?.links || [];
                            const linksChanged = JSON.stringify(originalLinks) !== JSON.stringify(newLinks);
                            if (linksChanged) {
                              setChanges(prev => ({ ...prev, links: { from: originalLinks, to: newLinks } }));
                            } else {
                              setChanges(prev => {
                                const { links, ...rest } = prev;
                                return rest;
                              });
                            }
                          }}
                          title="Remove link"
                          className={styles.linkRemoveBtn}
                        >
                          <FaTimes />
                        </Button>
                      </div>
                    );
                  })}

                  {/* Add new link button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newLinks = [...(formData.links || []), { type: 'custom', title: '', url: '', username: '', meta: {} }];
                      setFormData(prev => ({ ...prev, links: newLinks }));
                    }}
                    className="mt-2"
                  >
                    <FaPlus className="me-2" />
                    Add Link
                  </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================
                  SECTION 4: Super Admin Permissions (Super Admin Only)
                  ============================================ */}
              {isSuperAdmin(user) && (
                <div className={styles.sectionCard}>
                  <div className={styles.sectionCardHeader}>
                    <h3><FaUserShield /> Super Admin Permissions</h3>
                  </div>
                  <div className={styles.sectionCardBody}>
                    {/* User Role Row */}
                    <div className={styles.adminSectionRow}>
                      <div className={styles.adminSectionLabel}>
                        <strong>Current Role: {formData.role === 'super_admin' ? 'Super Admin' : 'Regular User'}</strong>
                        <p>Change this user's role. Super admins have full access to all resources and user management.</p>
                      </div>
                      <div className={styles.adminSectionActions}>
                        <button
                          type="button"
                          className={`${styles.adminActionBtn} ${formData.role === 'super_admin' ? styles.active : styles.inactive}`}
                          onClick={() => {
                            if (formData.role !== 'super_admin') {
                              setFormData(prev => ({ ...prev, role: 'super_admin' }));
                              if (originalUser?.role !== 'super_admin') {
                                setChanges(prev => ({ ...prev, role: { from: 'Regular User', to: 'Super Admin' } }));
                              } else {
                                setChanges(prev => {
                                  const { role, ...rest } = prev;
                                  return rest;
                                });
                              }
                            }
                          }}
                        >
                          Make Super Admin
                        </button>
                        <button
                          type="button"
                          className={`${styles.adminActionBtn} ${formData.role === 'regular_user' || !formData.role ? styles.active : styles.inactive}`}
                          onClick={() => {
                            if (formData.role !== 'regular_user') {
                              setFormData(prev => ({ ...prev, role: 'regular_user' }));
                              if (originalUser?.role !== 'regular_user' && originalUser?.role) {
                                setChanges(prev => ({ ...prev, role: { from: 'Super Admin', to: 'Regular User' } }));
                              } else {
                                setChanges(prev => {
                                  const { role, ...rest } = prev;
                                  return rest;
                                });
                              }
                            }
                          }}
                        >
                          Make Regular User
                        </button>
                      </div>
                    </div>

                    {/* Email Status Row */}
                    <div className={styles.adminSectionRow}>
                      <div className={styles.adminSectionLabel}>
                        <strong>
                          Email Status:{' '}
                          <span className={`${styles.statusBadge} ${formData.emailConfirmed ? styles.confirmed : styles.unconfirmed}`}>
                            <FaCheckCircle /> {formData.emailConfirmed ? 'Confirmed' : 'Unconfirmed'}
                          </span>
                        </strong>
                        <p>Manually confirm or unconfirm this user's email address.</p>
                      </div>
                      <div className={styles.adminSectionActions}>
                        <button
                          type="button"
                          className={`${styles.adminActionBtn} ${formData.emailConfirmed ? styles.active : styles.inactive}`}
                          onClick={() => {
                            if (!formData.emailConfirmed) {
                              setFormData(prev => ({ ...prev, emailConfirmed: true }));
                              if (!originalUser?.emailConfirmed) {
                                setChanges(prev => ({ ...prev, emailConfirmed: { from: 'Unconfirmed', to: 'Confirmed' } }));
                              } else {
                                setChanges(prev => {
                                  const { emailConfirmed, ...rest } = prev;
                                  return rest;
                                });
                              }
                            }
                          }}
                        >
                          Confirm Email
                        </button>
                        <button
                          type="button"
                          className={`${styles.adminActionBtn} ${!formData.emailConfirmed ? styles.danger : styles.inactive}`}
                          onClick={() => {
                            if (formData.emailConfirmed) {
                              setFormData(prev => ({ ...prev, emailConfirmed: false }));
                              if (originalUser?.emailConfirmed) {
                                setChanges(prev => ({ ...prev, emailConfirmed: { from: 'Confirmed', to: 'Unconfirmed' } }));
                              } else {
                                setChanges(prev => {
                                  const { emailConfirmed, ...rest } = prev;
                                  return rest;
                                });
                              }
                            }
                          }}
                        >
                          Unconfirm Email
                        </button>
                      </div>
                    </div>

                    {/* Feature Flags Section */}
                    <div className={styles.adminSectionRow} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                      <div className={styles.adminSectionLabel} style={{ marginBottom: 'var(--space-4)' }}>
                        <strong style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <FaFlag /> Feature Flags
                        </strong>
                        <p>Add or remove feature flags to control access to premium and experimental features for this user.</p>
                      </div>

                      {/* Active flags as pills */}
                      {getActiveFlags().length > 0 && (
                        <div className={styles.featureFlagsPills}>
                          {getActiveFlags().map((flag) => (
                            <div
                              key={flag.flag}
                              className={styles.featureFlagPillActive}
                              title={`${flag.description} (${flag.tier})`}
                            >
                              <span className={styles.featureFlagName}>{flag.flag}</span>
                              <span className={styles.featureFlagTier}>{flag.tier}</span>
                              <button
                                type="button"
                                className={styles.featureFlagRemove}
                                onClick={() => handleRemoveFeatureFlag(flag.flag)}
                                title="Remove flag"
                                aria-label={`Remove ${flag.flag} flag`}
                              >
                                <FaTimes size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Autocomplete dropdown to add new flags */}
                      {getAvailableFlags().length > 0 && (
                        <div className={styles.featureFlagAutocomplete}>
                          <Autocomplete
                            placeholder="Add a feature flag..."
                            items={getAvailableFlags().map(f => ({
                              id: f.key,
                              name: f.key,
                              label: f.description,
                              tier: f.tier
                            }))}
                            entityType="category"
                            value={flagSearchValue}
                            onChange={(e) => setFlagSearchValue(e.target.value)}
                            onSelect={(item) => {
                              if (item && item.id) {
                                handleAddFeatureFlag(item.id);
                                setFlagSearchValue(""); // Clear the input after selection
                              }
                            }}
                            showMeta={true}
                            size="sm"
                            emptyMessage="All flags have been added"
                          />
                        </div>
                      )}

                      <Form.Text style={{ color: 'var(--bs-gray-600)' }}>
                        {getAvailableFlags().length === 0
                          ? 'All available feature flags have been added.'
                          : 'Select a flag from the dropdown to add it. Click the × to remove a flag.'}
                      </Form.Text>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================
                  SECTION 5: Danger Zone (Delete Account - Self only)
                  ============================================ */}
              {isEditingSelf && (
                <div className={`${styles.sectionCard} ${styles.dangerZone}`}>
                  <div className={styles.sectionCardHeader}>
                    <h3><FaTrash /> Danger Zone</h3>
                  </div>
                  <div className={styles.sectionCardBody}>
                    <div className={styles.dangerItem}>
                      <div className={styles.dangerItemInfo}>
                        <strong>Delete Account</strong>
                        {isDemoMode && user?.email === DEMO_USER_EMAIL ? (
                          <p className={styles.demoAccountWarning}>
                            This is a demo account and cannot be deleted. It is used for demonstration purposes.
                            You can still explore all other features of the application.
                          </p>
                        ) : (
                          <p>Permanently delete your account and all associated data. This action cannot be undone.</p>
                        )}
                      </div>
                      {isDemoMode && user?.email === DEMO_USER_EMAIL ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="md"
                          disabled
                          title="Demo account cannot be deleted"
                        >
                          <FaTrash className="me-2" />
                          Delete Account
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="danger"
                          size="md"
                          onClick={() => setShowDeleteAccountModal(true)}
                        >
                          <FaTrash className="me-2" />
                          Delete Account
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Form Actions */}
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

      {/* Delete Account Modal */}
      <DeleteAccountModal
        show={showDeleteAccountModal}
        onClose={handleDeleteModalClose}
        user={user}
        onSuccess={handleDeleteSuccess}
      />
    </>
  );
}
