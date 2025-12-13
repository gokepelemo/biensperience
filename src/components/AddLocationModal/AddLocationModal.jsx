/**
 * AddLocationModal Component
 * Multi-step modal for adding a location to a plan item.
 * Step 1: Enter address
 * Step 2: Confirm geocoded address on map
 */

import { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FaMapMarkerAlt, FaSearch, FaSpinner, FaCheck } from 'react-icons/fa';
import Modal from '../Modal/Modal';
import GoogleMap from '../GoogleMap/GoogleMap';
import { Button } from '../design-system';
import styles from './AddLocationModal.module.scss';
import { logger } from '../../utilities/logger';
import { sendRequest } from '../../utilities/send-request';
import { lang } from '../../lang.constants';

// Steps for the modal wizard
const STEPS = {
  ENTER_ADDRESS: 1,
  CONFIRM_LOCATION: 2
};

/**
 * Geocode an address using the backend API
 */
async function geocodeAddress(address) {
  return sendRequest('/api/geocode', 'POST', { address });
}

export default function AddLocationModal({
  show,
  onClose,
  onSave,
  initialAddress = '',
  initialLocation = null
}) {
  const [currentStep, setCurrentStep] = useState(STEPS.ENTER_ADDRESS);
  const [address, setAddress] = useState(initialAddress);
  const [geocodedLocation, setGeocodedLocation] = useState(initialLocation);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (show) {
      setCurrentStep(STEPS.ENTER_ADDRESS);
      setAddress(initialAddress);
      setGeocodedLocation(initialLocation);
      setError(null);
    }
  }, [show, initialAddress, initialLocation]);

  // Handle address search
  const handleSearch = useCallback(async () => {
    if (!address.trim()) {
      setError(lang.current.addLocationModal.pleaseEnterAddress);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await geocodeAddress(address.trim());

      if (!result || !result.latitude || !result.longitude) {
        throw new Error(lang.current.addLocationModal.couldNotFindLocation);
      }

      setGeocodedLocation(result);
      setCurrentStep(STEPS.CONFIRM_LOCATION);
      logger.info('[AddLocationModal] Address geocoded successfully', { address, result });
    } catch (err) {
      logger.error('[AddLocationModal] Geocoding failed', { error: err.message });
      setError(err.message || lang.current.addLocationModal.failedToFindLocation);
    } finally {
      setLoading(false);
    }
  }, [address]);

  // Handle back button
  const handleBack = useCallback(() => {
    setCurrentStep(STEPS.ENTER_ADDRESS);
    setError(null);
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!geocodedLocation) {
      setError(lang.current.addLocationModal.noLocationToSave);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build location object for the plan item
      const locationData = {
        address: geocodedLocation.displayName || address,
        geo: {
          type: 'Point',
          coordinates: [geocodedLocation.longitude, geocodedLocation.latitude]
        },
        city: geocodedLocation.city || null,
        state: geocodedLocation.state || null,
        country: geocodedLocation.country || null,
        postalCode: geocodedLocation.postalCode || null,
        placeId: geocodedLocation.placeId || null
      };

      await onSave(locationData);
      onClose();
    } catch (err) {
      logger.error('[AddLocationModal] Save failed', { error: err.message });
      setError(err.message || lang.current.addLocationModal.failedToSaveLocation);
    } finally {
      setLoading(false);
    }
  }, [geocodedLocation, address, onSave, onClose]);

  // Handle key press in address input
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  }, [handleSearch]);

  // Get step title
  const getStepTitle = () => {
    if (currentStep === STEPS.ENTER_ADDRESS) {
      return lang.current.addLocationModal.addLocation;
    }
    return lang.current.addLocationModal.confirmLocation;
  };

  // Build location string for map
  const getMapLocation = () => {
    if (!geocodedLocation) return null;

    // Prefer displayName, fall back to coordinates
    if (geocodedLocation.displayName) {
      return geocodedLocation.displayName;
    }

    if (geocodedLocation.latitude && geocodedLocation.longitude) {
      return `${geocodedLocation.latitude},${geocodedLocation.longitude}`;
    }

    return null;
  };

  if (!show) return null;

  return (
    <Modal
      show={show}
      onClose={onClose}
      title={getStepTitle()}
      size="lg"
    >
      <div className={styles.addLocationModal}>
        {/* Step indicator */}
        <div className={styles.stepIndicator}>
          <div className={`${styles.step} ${currentStep >= STEPS.ENTER_ADDRESS ? styles.active : ''} ${currentStep > STEPS.ENTER_ADDRESS ? styles.completed : ''}`}>
            <span className={styles.stepNumber}>1</span>
            <span className={styles.stepLabel}>{lang.current.addLocationModal.stepAddress}</span>
          </div>
          <div className={styles.stepConnector} />
          <div className={`${styles.step} ${currentStep >= STEPS.CONFIRM_LOCATION ? styles.active : ''}`}>
            <span className={styles.stepNumber}>2</span>
            <span className={styles.stepLabel}>{lang.current.addLocationModal.stepConfirm}</span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}

        {/* Step content */}
        <div className={styles.stepContent}>
          {currentStep === STEPS.ENTER_ADDRESS && (
            <div className={styles.addressStep}>
              <div className={styles.addressInputWrapper}>
                <FaMapMarkerAlt className={styles.addressIcon} />
                <input
                  type="text"
                  className={styles.addressInput}
                  placeholder={lang.current.addLocationModal.enterAddressPlaceholder}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={loading}
                  autoFocus
                />
                <button
                  type="button"
                  className={styles.searchButton}
                  onClick={handleSearch}
                  disabled={loading || !address.trim()}
                >
                  {loading ? (
                    <FaSpinner className={styles.spinner} />
                  ) : (
                    <FaSearch />
                  )}
                </button>
              </div>
              <p className={styles.addressHint}>
                {lang.current.addLocationModal.addressHint}
              </p>
            </div>
          )}

          {currentStep === STEPS.CONFIRM_LOCATION && geocodedLocation && (
            <div className={styles.confirmStep}>
              <div className={styles.locationDetails}>
                <div className={styles.locationIcon}>
                  <FaMapMarkerAlt />
                </div>
                <div className={styles.locationInfo}>
                  <div className={styles.locationAddress}>
                    {geocodedLocation.displayName || address}
                  </div>
                  {(geocodedLocation.city || geocodedLocation.state || geocodedLocation.country) && (
                    <div className={styles.locationMeta}>
                      {[geocodedLocation.city, geocodedLocation.state, geocodedLocation.country]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.mapPreview}>
                <GoogleMap
                  location={getMapLocation()}
                  height={300}
                  showDirections={false}
                  title={lang.current.addLocationModal.locationPreview}
                />
              </div>

              <p className={styles.confirmHint}>
                {lang.current.addLocationModal.confirmHint}
              </p>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className={styles.footerButtons}>
          {currentStep === STEPS.CONFIRM_LOCATION && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={loading}
            >
              {lang.current.addLocationModal.back}
            </Button>
          )}

          {currentStep === STEPS.ENTER_ADDRESS && (
            <Button
              variant="primary"
              onClick={handleSearch}
              disabled={loading || !address.trim()}
            >
              {loading ? (
                <>
                  <FaSpinner className={styles.buttonSpinner} />
                  {lang.current.addLocationModal.searching}
                </>
              ) : (
                <>
                  <FaSearch />
                  {lang.current.addLocationModal.findLocation}
                </>
              )}
            </Button>
          )}

          {currentStep === STEPS.CONFIRM_LOCATION && (
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? (
                <>
                  <FaSpinner className={styles.buttonSpinner} />
                  {lang.current.addLocationModal.saving}
                </>
              ) : (
                <>
                  <FaCheck />
                  {lang.current.addLocationModal.confirmLocationButton}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

AddLocationModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  initialAddress: PropTypes.string,
  initialLocation: PropTypes.object
};
