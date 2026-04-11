import styles from "./Profile.module.css";
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { FaCrosshairs, FaPlus, FaTimes, FaStar, FaGlobe, FaExternalLinkAlt, FaFlag, FaLink, FaUser, FaCamera, FaUserShield, FaCheckCircle, FaTrash, FaKey } from "react-icons/fa";
import { getSocialNetworkOptions, getSocialNetwork, buildLinkUrl, getLinkIcon } from "../../utilities/social-links";
import PhotoUpload from "../../components/PhotoUpload/PhotoUpload";
import Loading from "../../components/Loading/Loading";
import { updateUser as updateUserAPI, updateUserAsAdmin, getUserData, checkCanManageFeatureFlags } from "../../utilities/users-api";
import { updateToken, logout } from "../../utilities/users-service";
import { useUser } from "../../contexts/UserContext";
import { useToast } from "../../contexts/ToastContext";
import { lang } from "../../lang.constants";
import PageOpenGraph from "../../components/OpenGraph/PageOpenGraph";
import { handleError } from "../../utilities/error-handler";
import { formatChanges } from "../../utilities/change-formatter";
import FormField from "../../components/FormField/FormField";
import { isSuperAdmin } from "../../utilities/permissions";
import { getPhotoObjects } from "../../utilities/photo-utils";
import { reverseGeocode } from "../../utilities/address-utils";
import { Spinner } from "@chakra-ui/react";
import { Button, Alert, Checkbox, FormTooltip, Modal, Form } from "../../components/design-system";
import { hasFeatureFlag, FEATURE_FLAGS } from "../../utilities/feature-flags";
import Autocomplete from "../../components/Autocomplete/Autocomplete";
import DeleteAccountModal from "../../components/DeleteAccountModal/DeleteAccountModal";
import { logger } from "../../utilities/logger";
import { getLinkedAccounts, unlinkAccount, linkAccount } from "../../utilities/oauth-service";
import { LinkedAccountRow } from "./components";

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
  const [canManageFlags, setCanManageFlags] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [linkedAccounts, setLinkedAccounts] = useState(null);
  const [linkedAccountsLoading, setLinkedAccountsLoading] = useState(true);
  const [unlinkingProvider, setUnlinkingProvider] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { userId } = useParams();

  // Track link changes against original user links
  const trackLinkChanges = useCallback((newLinks) => {
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
  }, [originalUser, setChanges]);

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

  // Fetch linked accounts on load (only for self-editing)
  useEffect(() => {
    async function fetchLinkedAccounts() {
      if (!isEditingSelf || !user) {
        setLinkedAccountsLoading(false);
        return;
      }

      try {
        const accounts = await getLinkedAccounts();
        setLinkedAccounts(accounts);
      } catch (err) {
        logger.error('[UpdateProfile] Failed to fetch linked accounts', { error: err.message });
        showError(lang.current.profile.failedToLoadLinkedAccounts);
      } finally {
        setLinkedAccountsLoading(false);
      }
    }

    fetchLinkedAccounts();
  }, [user, isEditingSelf, showError]);

  // Check if current super admin can manage feature flags
  useEffect(() => {
    if (!isSuperAdmin(user)) return;
    let cancelled = false;
    checkCanManageFeatureFlags().then(result => {
      if (!cancelled) setCanManageFlags(result);
    }).catch(() => {
      if (!cancelled) setCanManageFlags(false);
    });
    return () => { cancelled = true; };
  }, [user]);

  // Handle linking an account (redirect to OAuth flow)
  const handleLinkAccount = (provider) => {
    linkAccount(provider);
  };

  // Handle unlinking an account
  const handleUnlinkAccount = async (provider) => {
    // Check if this is the only auth method
    if (linkedAccounts) {
      const linkedCount = [linkedAccounts.facebook, linkedAccounts.google, linkedAccounts.twitter].filter(Boolean).length;
      if (linkedCount <= 1 && !linkedAccounts.hasPassword) {
        showError(lang.current.profile.cannotUnlinkOnlyAuth);
        return;
      }
    }

    setUnlinkingProvider(provider);
    try {
      await unlinkAccount(provider);
      // Refresh linked accounts
      const accounts = await getLinkedAccounts();
      setLinkedAccounts(accounts);
      success(lang.current.profile.accountUnlinkedSuccess.replace('{provider}', provider.charAt(0).toUpperCase() + provider.slice(1)));
    } catch (err) {
      logger.error('[UpdateProfile] Failed to unlink account', { error: err.message, provider });
      showError(lang.current.profile.failedToUnlinkAccount.replace('{provider}', provider.charAt(0).toUpperCase() + provider.slice(1)));
    } finally {
      setUnlinkingProvider(null);
    }
  };

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
          // Self mode: always fetch fresh profile data to ensure populated photos
          userData = await getUserData(user._id);
        }

        // Deep clone to ensure originalUser and formData are independent
        const clonedUserData = JSON.parse(JSON.stringify(userData));
        // Normalize photos to IDs for consistent comparison (if PhotoUpload is used)
        if (clonedUserData.photos) {
          clonedUserData.photos = clonedUserData.photos.map(entry => {
            // Handle photoEntry wrapper: {photo: PhotoDoc|ObjectId, default: bool}
            if (entry && typeof entry === 'object' && 'photo' in entry && 'default' in entry) {
              const p = entry.photo;
              return typeof p === 'object' && p ? (p._id || p) : p;
            }
            return entry?._id || entry;
          });
        }
        setOriginalUser(clonedUserData);
        setFormData({
          ...JSON.parse(JSON.stringify(userData)),
          photos_full: getPhotoObjects(userData),
        });
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
  }, [user, userId, isAdminMode]);

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
          setPasswordError(lang.current.profile.newPasswordsDoNotMatch);
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
      showError(lang.current.profile.geolocationNotSupported);
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
            location: { from: originalLocation || lang.current.profile.locationNotSet, to: newLocation }
          }));
        }

        success(lang.current.profile.locationSet.replace('{location}', city || geocoded.formattedAddress));
      } else {
        showError(lang.current.profile.locationLookupFailed);
      }
    } catch (err) {
      if (err.code === 1) {
        showError(lang.current.profile.locationAccessDenied);
      } else if (err.code === 2) {
        showError(lang.current.profile.locationUnavailable);
      } else if (err.code === 3) {
        showError(lang.current.profile.locationTimeout);
      } else {
        showError(lang.current.profile.locationFailed);
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

    // Normalize a photo value to a plain ID string.
    // Handles photoEntry wrappers { photo: PhotoDoc/ObjectId, default: bool } (_id: false),
    // plain Photo documents, ObjectIds, and bare strings.
    const normalizeId = (p) => {
      if (!p) return null;
      if (typeof p === 'string') return p;
      // photoEntry wrapper: { photo: ..., default: bool }
      const val = ('photo' in p && 'default' in p) ? (p.photo || p) : p;
      if (typeof val === 'string') return val;
      if (val && val._id) return val._id.toString();
      return val ? val.toString() : null;
    };

    // Normalize for comparison: extract IDs from objects/wrappers, keep strings as-is
    const normalizePhotos = (photos) => {
      return photos.map(normalizeId).filter(Boolean).sort();
    };

    const originalPhotoIds = normalizePhotos(originalPhotos);
    const currentPhotoIds = normalizePhotos(currentPhotos);

    const photosChanged = JSON.stringify(originalPhotoIds) !== JSON.stringify(currentPhotoIds);

    if (photosChanged) {
      const fromText = originalPhotos.length === 0 ? lang.current.profile.noPhotos : (originalPhotos.length > 1 ? lang.current.profile.photosCountPlural.replace('{count}', originalPhotos.length) : lang.current.profile.photosCount.replace('{count}', originalPhotos.length));
      const toText = currentPhotos.length === 0 ? lang.current.profile.noPhotos : (currentPhotos.length > 1 ? lang.current.profile.photosCountPlural.replace('{count}', currentPhotos.length) : lang.current.profile.photosCount.replace('{count}', currentPhotos.length));

      newChanges.photos = {
        from: fromText,
        to: toText
      };
    } else {
      delete newChanges.photos;
    }

    // Check if default photo changed

    // Derive default photo IDs from the photos[].default schema
    const originalDefaultEntry = (originalUser.photos || []).find(p => p?.default);
    const originalDefaultId = originalDefaultEntry
      ? (originalDefaultEntry.photo?._id || originalDefaultEntry.photo)
      : null;

    const currentDefaultEntry = (formData.photos || []).find(p => p?.default);
    const currentDefaultId = currentDefaultEntry
      ? (currentDefaultEntry.photo?._id || currentDefaultEntry.photo)
      : null;

    // Normalize default photo IDs for comparison
    const originalDefaultRaw = normalizeId(originalDefaultId);
    const isOriginalDefaultValid = originalDefaultRaw !== null &&
      originalPhotoIds.includes(originalDefaultRaw);

    // If original default was invalid or missing, fall back to first photo as implicit default
    let normalizedOriginalDefault = isOriginalDefaultValid
      ? originalDefaultRaw
      : (originalPhotoIds[0] || null);

    let normalizedCurrentDefault = normalizeId(currentDefaultId);
    // Treat first photo as implicit default when current default is not set but photos exist
    if (!normalizedCurrentDefault && currentPhotos.length > 0) {
      normalizedCurrentDefault = normalizeId(currentPhotos[0]);
    }

    // Don't consider it a change if PhotoUpload automatically set the first photo as default
    // when there was no valid original default (null or pointing to a photo outside the array)
    // and photos themselves haven't changed
    const firstCurrentPhotoId = currentPhotos.length > 0 ? normalizeId(currentPhotos[0]) : null;
    const isAutoDefaultSet = !isOriginalDefaultValid && // No valid original default
                             currentDefaultId && // Current has default set
                             JSON.stringify(originalPhotoIds) === JSON.stringify(currentPhotoIds) && // Photos haven't changed
                             normalizedCurrentDefault === firstCurrentPhotoId; // Default is first photo (what PhotoUpload auto-selects)

    if (normalizedOriginalDefault !== normalizedCurrentDefault && currentPhotos.length > 0 && !isAutoDefaultSet) {
      // Find the index of the default photo for description
      const getPhotoIndex = (photoId, photoArray) => {
        if (!photoId) return -1;
        const normalizedId = normalizeId(photoId);
        return photoArray.findIndex(p => normalizeId(p) === normalizedId);
      };

      const originalIndex = getPhotoIndex(originalDefaultId, originalPhotos);
      const currentIndex = getPhotoIndex(currentDefaultId, currentPhotos);

      newChanges.default_photo = {
        from: originalIndex >= 0 ? lang.current.profile.photoIndex.replace('{index}', originalIndex + 1) : lang.current.profile.none,
        to: currentIndex >= 0 ? lang.current.profile.photoIndex.replace('{index}', currentIndex + 1) : lang.current.profile.none
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

  // Warn about unsaved changes on browser/tab close
  const hasUnsavedChanges = !isInitialLoad && Object.keys(changes).length > 0;

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  // Warn about unsaved changes on in-app back/forward navigation
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e) => {
      if (!window.confirm(lang.current.alert.unsavedChangesMessage)) {
        e.preventDefault();
        // Push state back to counteract the popstate
        window.history.pushState(null, '', window.location.href);
      }
    };
    // Push a duplicate entry so we can intercept back navigation
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [hasUnsavedChanges]);

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
        setPasswordError(lang.current.profile.oldPasswordRequired);
        return;
      }
      if (!passwordData.newPassword) {
        setPasswordError(isEditingSelf ? lang.current.profile.newPasswordRequired : lang.current.profile.passwordRequired);
        return;
      }
      if (!passwordData.confirmPassword) {
        setPasswordError(isEditingSelf ? lang.current.profile.confirmNewPasswordPrompt : lang.current.profile.confirmPasswordPrompt);
        return;
      }
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setPasswordError(isEditingSelf ? lang.current.profile.newPasswordsDoNotMatch : lang.current.profile.passwordsDoNotMatch);
        return;
      }
      if (passwordData.newPassword.length < 3) {
        setPasswordError(lang.current.profile.passwordMinLength);
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
          const actualFieldName = field;
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
        setChanges({});
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
        setChanges({});
        success(lang.current.notification?.profile?.updated || "Your profile has been updated. Changes are now visible to others.");
        navigate('/profile');
      }
    } catch (err) {
      const errorMsg = handleError(err, { context: isAdminMode ? 'Update user profile' : 'Update profile' });
      setError(errorMsg || lang.current.profile.failedToUpdateProfile);
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
        title={isAdminMode ? lang.current.profile.editUserTitle.replace('{name}', currentUser?.name) : lang.current.profile.editProfileTitle.replace('{name}', user.name)}
        description={isAdminMode ? lang.current.profile.adminDescription : lang.current.profile.selfDescription}
        keywords={lang.current.profile.keywords}
        ogTitle={isAdminMode ? lang.current.profile.editUserTitle.replace('{name}', currentUser?.name) : lang.current.profile.editProfileTitle.replace('{name}', user.name)}
        ogDescription={isAdminMode ? lang.current.profile.adminOgDescription : lang.current.profile.selfOgDescription}
      />

      <div className={`${styles.row} animation-fade-in`}>
        <div className={styles.col12}>
          <h1 className="form-title">
            {isAdminMode ?
              lang.current.profile.editUserProfile.replace('{name}', currentUser?.name).replace('{email}', currentUser?.email) :
              lang.current.profile.updateYourProfile
            }
          </h1>
        </div>
      </div>

      {error && (
        <Alert
          type="danger"
          message={error}
          className={styles.mb4}
        />
      )}

      {!loading && !isInitialLoad && Object.keys(changes).length > 0 && (
        <Alert
          type="info"
          className={styles.mb4}
        >
          <strong>{lang.current.profile.changesDetected}</strong>
          <ul className={styles.changesList}>
            {Object.keys(changes).map((field, idx) => (
              <li key={idx} className="whitespace-pre-line">
                {formatChanges(field, changes[field], 'profile')}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {isAdminMode && !isSuperAdmin(user) ? (
        <div className={`${styles.profileContainer} ${styles.mt4}`}>
          <Alert type="danger" message={lang.current.alert.accessDeniedAction} />
        </div>
      ) : loading ? (
        <Loading variant="centered" size="lg" message={lang.current.alert.loadingProfile} />
      ) : (
        <div className={`row ${styles.my4} animation-fade-in ${styles.justifyCenter}`}>
          <div className={styles.col12}>
            <Form className="form-unified" autoComplete="off" onSubmit={handleSubmit}>

              {/* ============================================
                  SECTION 1: Basic Information
                  ============================================ */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionCardHeader}>
                  <h3><FaUser /> {lang.current.profile.basicInfo}</h3>
                </div>
                <div className={styles.sectionCardBody}>
                  <FormField
                    name="name"
                    label={lang.current.profile.name}
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
                    label={lang.current.profile.emailAddress}
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder={lang.current.placeholder.emailField}
                    required
                    autoComplete="email"
                    tooltip={lang.current.helper.profileEmail}
                    tooltipPlacement="top"
                  />

                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <FormField
                        name="location"
                        label={lang.current.profile.location}
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
                              location: { from: originalLocation || lang.current.profile.locationNotSet, to: newLocation || lang.current.profile.locationNotSet }
                            }));
                          } else {
                            setChanges(prev => {
                              const newChanges = { ...prev };
                              delete newChanges.location;
                              return newChanges;
                            });
                          }
                        }}
                        placeholder={lang.current.profile.locationPlaceholder}
                        autoComplete="address-level2"
                        tooltip={lang.current.profile.locationTooltip}
                        tooltipPlacement="top"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={handleUseCurrentLocation}
                      disabled={geolocating}
                      title={lang.current.profile.useCurrentLocation}
                      aria-label={lang.current.profile.useCurrentLocation}
                      style={{
                        flexShrink: 0,
                        width: 'clamp(36px, var(--btn-height-md), 44px)',
                        height: 'clamp(36px, var(--btn-height-md), 44px)',
                        minHeight: 'var(--btn-height-md)',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        // Let flex alignment control vertical positioning
                      }}
                    >
                      {geolocating ? (
                        <Spinner size="sm" />
                      ) : (
                        <FaCrosshairs />
                      )}
                    </Button>
                  </div>
                  {formData.location?.city && formData.location?.country && !formData.locationQuery && (
                    <p className={styles.locationHint}>
                      {lang.current.profile.currentLocation.replace('{location}', `${formData.location.city}${formData.location.state ? `, ${formData.location.state}` : ''}, ${formData.location.country}`)}
                    </p>
                  )}

                  {/* Collapsible Change Password Section */}
                  {showPasswordFields ? (
                    <>
                      <h5 className={`form-section-header ${styles.mt4}`}>{lang.current.profile.changePassword}</h5>
                      {passwordError && (
                        <Alert
                          type="danger"
                          message={passwordError}
                        />
                      )}

                      {isEditingSelf && (
                        <FormField
                          name="oldPassword"
                          label={lang.current.profile.currentPassword}
                          type="password"
                          value={passwordData.oldPassword}
                          onChange={handlePasswordChange}
                          placeholder={lang.current.placeholder.enterCurrentPassword}
                          autoComplete="current-password"
                          tooltip={lang.current.helper.currentPassword}
                          tooltipPlacement="top"
                          className={styles.mb3}
                        />
                      )}

                      <FormField
                        name="newPassword"
                        label={isEditingSelf ? lang.current.profile.newPassword : lang.current.profile.password}
                        type="password"
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        placeholder={isEditingSelf ? lang.current.profile.enterNewPasswordPlaceholder : lang.current.profile.enterPasswordPlaceholder}
                        autoComplete="new-password"
                        minLength={3}
                        tooltip={isEditingSelf ? lang.current.helper.newPassword : lang.current.profile.setPasswordTooltip}
                        tooltipPlacement="top"
                        className={styles.mb3}
                      />

                      <FormField
                        name="confirmPassword"
                        label={lang.current.profile.confirmNewPassword}
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        placeholder={lang.current.placeholder.confirmNewPassword}
                        autoComplete="new-password"
                        tooltip={lang.current.helper.confirmPassword}
                        tooltipPlacement="top"
                        className={styles.mb3}
                      />
                    </>
                  ) : (
                    <div className={styles.mt4}>
                      <button
                        className={`btn btn-link ${styles.p0} ${styles.noTextDecoration}`}
                        onClick={() => setShowPasswordFields(true)}
                        type="button"
                        aria-expanded={showPasswordFields}
                      >
                        + {lang.current.profile.changePassword}
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
                  <h3><FaCamera /> {lang.current.profile.profilePhoto}</h3>
                </div>
                <div className={styles.sectionCardBody}>
                  <PhotoUpload data={formData} setData={setFormData} />
                </div>
              </div>

              {/* ============================================
                  SECTION 3: Linked Accounts (Self-editing only)
                  ============================================ */}
              {isEditingSelf && (
                <div className={styles.sectionCard}>
                  <div className={styles.sectionCardHeader}>
                    <h3><FaLink /> {lang.current.profile.linkedAccounts}</h3>
                  </div>
                  <div className={styles.sectionCardBody}>
                    <p className={styles.linkedAccountsDesc}>{lang.current.profile.linkedAccountsDescription}</p>

                    {linkedAccountsLoading ? (
                      <div className={styles.linkedAccountsLoading}>
                        <Spinner size="sm" />
                      </div>
                    ) : linkedAccounts ? (
                      <>
                        <div className={styles.linkedAccountsList}>
                          {['facebook', 'google', 'twitter'].map(provider => (
                            <LinkedAccountRow
                              key={provider}
                              provider={provider}
                              isLinked={!!linkedAccounts[provider]}
                              linkedAt={linkedAccounts.accounts?.find(a => a.provider === provider)?.linkedAt}
                              onLink={handleLinkAccount}
                              onUnlink={handleUnlinkAccount}
                              unlinking={unlinkingProvider === provider}
                            />
                          ))}
                        </div>

                        {/* Password status indicator */}
                        <div className={`${styles.linkedAccountsPasswordStatus} ${!linkedAccounts.hasPassword ? styles.noPassword : ''}`}>
                          <FaKey />
                          <span>{linkedAccounts.hasPassword ? lang.current.profile.hasPassword : lang.current.profile.noPassword}</span>
                        </div>
                      </>
                    ) : (
                      <div className={styles.linkedAccountsEmpty}>
                        <p>{lang.current.profile.noLinkedAccounts}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ============================================
                  SECTION 4: Curator Profile (Only for curators)
                  ============================================ */}
              {hasFeatureFlag(currentUser, 'curator') && (
                <div className={styles.sectionCard}>
                  <div className={styles.sectionCardHeader}>
                    <h3><FaStar /> {lang.current.profile.curatorProfile}</h3>
                  </div>
                  <div className={styles.sectionCardBody}>
                    <FormField
                      name="bio"
                      label={lang.current.profile.curatorBio}
                      as="textarea"
                      rows={4}
                      value={formData.bio || ''}
                      onChange={handleChange}
                      placeholder={lang.current.profile.curatorBioPlaceholder}
                      maxLength={500}
                      tooltip={lang.current.profile.curatorBioTooltip}
                      tooltipPlacement="top"
                      className={styles.mb3}
                    />

                    <div className={styles.mb3}>
                      <label className={`form-label ${styles.curatorLinksLabel}`}>
                        <FaLink />
                        {lang.current.profile.curatorLinks}
                        <FormTooltip
                          content={lang.current.profile.curatorLinksTooltip}
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
                              trackLinkChanges(newLinks);
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
                                placeholder={lang.current.profile.linkTitle}
                                value={link.title || ''}
                                onChange={(e) => {
                                  const newLinks = [...(formData.links || [])];
                                  newLinks[index] = { ...newLinks[index], title: e.target.value };
                                  setFormData(prev => ({ ...prev, links: newLinks }));
                                  trackLinkChanges(newLinks);
                                }}
                                style={{ maxWidth: '150px' }}
                              />
                              <input
                                type="url"
                                className={`form-control ${styles.flexGrow1}`}
                                placeholder={network?.placeholder || lang.current.profile.linkUrl}
                                value={link.url || ''}
                                onChange={(e) => {
                                  const newLinks = [...(formData.links || [])];
                                  newLinks[index] = { ...newLinks[index], url: e.target.value };
                                  setFormData(prev => ({ ...prev, links: newLinks }));
                                  trackLinkChanges(newLinks);
                                }}
                              />
                            </>
                          ) : (
                            // Social network: username only
                            <input
                              type="text"
                              className={`form-control ${styles.flexGrow1}`}
                              placeholder={network?.placeholder || lang.current.profile.linkUsername}
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
                                trackLinkChanges(newLinks);
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
                            trackLinkChanges(newLinks);
                          }}
                          title={lang.current.profile.removeLink}
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
                    className={styles.mt2}
                  >
                    <FaPlus className={styles.me2} />
                    {lang.current.profile.addLink}
                  </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================
                  SECTION 5: Super Admin Permissions (Super Admin Only)
                  ============================================ */}
              {isSuperAdmin(user) && (
                <div className={styles.sectionCard}>
                  <div className={styles.sectionCardHeader}>
                    <h3><FaUserShield /> {lang.current.profile.superAdminPermissions}</h3>
                  </div>
                  <div className={styles.sectionCardBody}>
                    {/* User Role Row */}
                    <div className={styles.adminSectionRow}>
                      <div className={styles.adminSectionLabel}>
                        <strong>{lang.current.profile.currentRole.replace('{role}', formData.role === 'super_admin' ? lang.current.profile.superAdmin : lang.current.profile.regularUser)}</strong>
                        <p>{lang.current.profile.roleDescription}</p>
                      </div>
                      <div className={styles.adminSectionActions}>
                        <button
                          type="button"
                          className={`${styles.adminActionBtn} ${formData.role === 'super_admin' ? styles.active : styles.inactive}`}
                          onClick={() => {
                            if (formData.role !== 'super_admin') {
                              setFormData(prev => ({ ...prev, role: 'super_admin' }));
                              if (originalUser?.role !== 'super_admin') {
                                setChanges(prev => ({ ...prev, role: { from: lang.current.profile.regularUser, to: lang.current.profile.superAdmin } }));
                              } else {
                                setChanges(prev => {
                                  const { role, ...rest } = prev;
                                  return rest;
                                });
                              }
                            }
                          }}
                        >
                          {lang.current.profile.makeSuperAdmin}
                        </button>
                        <button
                          type="button"
                          className={`${styles.adminActionBtn} ${formData.role === 'regular_user' || !formData.role ? styles.active : styles.inactive}`}
                          onClick={() => {
                            if (formData.role !== 'regular_user') {
                              setFormData(prev => ({ ...prev, role: 'regular_user' }));
                              if (originalUser?.role !== 'regular_user' && originalUser?.role) {
                                setChanges(prev => ({ ...prev, role: { from: lang.current.profile.superAdmin, to: lang.current.profile.regularUser } }));
                              } else {
                                setChanges(prev => {
                                  const { role, ...rest } = prev;
                                  return rest;
                                });
                              }
                            }
                          }}
                        >
                          {lang.current.profile.makeRegularUser}
                        </button>
                      </div>
                    </div>

                    {/* Email Status Row */}
                    <div className={styles.adminSectionRow}>
                      <div className={styles.adminSectionLabel}>
                        <strong>
                          {lang.current.profile.emailStatus}:{' '}
                          <span className={`${styles.statusBadge} ${formData.emailConfirmed ? styles.confirmed : styles.unconfirmed}`}>
                            <FaCheckCircle /> {formData.emailConfirmed ? lang.current.profile.emailConfirmed : lang.current.profile.emailUnconfirmed}
                          </span>
                        </strong>
                        <p>{lang.current.profile.emailStatusDescription}</p>
                      </div>
                      <div className={styles.adminSectionActions}>
                        <button
                          type="button"
                          className={`${styles.adminActionBtn} ${formData.emailConfirmed ? styles.active : styles.inactive}`}
                          onClick={() => {
                            if (!formData.emailConfirmed) {
                              setFormData(prev => ({ ...prev, emailConfirmed: true }));
                              if (!originalUser?.emailConfirmed) {
                                setChanges(prev => ({ ...prev, emailConfirmed: { from: lang.current.profile.emailUnconfirmed, to: lang.current.profile.emailConfirmed } }));
                              } else {
                                setChanges(prev => {
                                  const { emailConfirmed, ...rest } = prev;
                                  return rest;
                                });
                              }
                            }
                          }}
                        >
                          {lang.current.profile.confirmEmail}
                        </button>
                        <button
                          type="button"
                          className={`${styles.adminActionBtn} ${!formData.emailConfirmed ? styles.danger : styles.inactive}`}
                          onClick={() => {
                            if (formData.emailConfirmed) {
                              setFormData(prev => ({ ...prev, emailConfirmed: false }));
                              if (originalUser?.emailConfirmed) {
                                setChanges(prev => ({ ...prev, emailConfirmed: { from: lang.current.profile.emailConfirmed, to: lang.current.profile.emailUnconfirmed } }));
                              } else {
                                setChanges(prev => {
                                  const { emailConfirmed, ...rest } = prev;
                                  return rest;
                                });
                              }
                            }
                          }}
                        >
                          {lang.current.profile.unconfirmEmail}
                        </button>
                      </div>
                    </div>

                    {/* Feature Flags Section */}
                    {canManageFlags && (
                    <div className={styles.adminSectionRow} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                      <div className={styles.adminSectionLabel} style={{ marginBottom: 'var(--space-4)' }}>
                        <strong style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <FaFlag /> {lang.current.profile.featureFlags}
                        </strong>
                        <p>{lang.current.profile.featureFlagsDescription}</p>
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
                                title={lang.current.profile.removeLink}
                                aria-label={lang.current.profile.removeFlagAriaLabel.replace('{flag}', flag.flag)}
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
                            placeholder={lang.current.profile.addFeatureFlag}
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
                            emptyMessage={lang.current.profile.allFlagsAdded}
                          />
                        </div>
                      )}

                      <Form.Text style={{ color: 'var(--color-text-muted)' }}>
                        {getAvailableFlags().length === 0
                          ? lang.current.profile.allFlagsAddedHelp
                          : lang.current.profile.flagSelectHelp}
                      </Form.Text>
                    </div>
                    )}
                  </div>
                </div>
              )}

              {/* ============================================
                  SECTION 6: Danger Zone (Delete Account - Self only)
                  ============================================ */}
              {isEditingSelf && (
                <div className={`${styles.sectionCard} ${styles.dangerZone}`}>
                  <div className={styles.sectionCardHeader}>
                    <h3><FaTrash /> {lang.current.profile.dangerZone}</h3>
                  </div>
                  <div className={styles.sectionCardBody}>
                    <div className={styles.dangerItem}>
                      <div className={styles.dangerItemInfo}>
                        <strong>{lang.current.profile.deleteAccount}</strong>
                        {isDemoMode && user?.email === DEMO_USER_EMAIL ? (
                          <p className={styles.demoAccountWarning}>
                            {lang.current.profile.demoAccountWarning}
                          </p>
                        ) : (
                          <p>{lang.current.profile.deleteAccountDescription}</p>
                        )}
                      </div>
                      {isDemoMode && user?.email === DEMO_USER_EMAIL ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="md"
                          disabled
                          title={lang.current.profile.demoCannotDelete}
                        >
                          <FaTrash className={styles.me2} />
                          {lang.current.profile.deleteAccount}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="danger"
                          size="md"
                          onClick={() => setShowDeleteAccountModal(true)}
                        >
                          <FaTrash className={styles.me2} />
                          {lang.current.profile.deleteAccount}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className={styles.formActions}>
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
        <Modal
          show={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          title={lang.current.profile.confirmProfileUpdate}
          centered
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowConfirmModal(false)}
                aria-label={lang.current.button.cancel}
              >
                {lang.current.button.cancel}
              </Button>
              <Button
                variant="primary"
                onClick={confirmUpdate}
                aria-label={lang.current.profile.updateProfile}
              >
                {lang.current.profile.updateProfile}
              </Button>
            </>
          }
        >
          <p>{lang.current.profile.confirmUpdateReview}</p>
          <ul className="list-group">
            {Object.entries(changes).map(([field, change]) => (
              <li key={field} className="list-group-item">
                <div className="whitespace-pre-line">
                  {formatChanges(field, change, 'profile')}
                </div>
              </li>
            ))}
          </ul>
        </Modal>
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
