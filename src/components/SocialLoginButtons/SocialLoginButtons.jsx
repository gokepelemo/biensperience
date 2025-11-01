import React, { useState, useEffect } from 'react';
import { FaFacebook, FaGoogle } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import './SocialLoginButtons.css';
import PropTypes from 'prop-types';
import { getAvailableProviders } from '../../utilities/oauth-service';

/**
 * Social Login Buttons Component
 * Displays OAuth login buttons for Facebook, Google, and X (formerly Twitter)
 * Only shows buttons for providers that are properly configured
 *
 * @param {Object} props
 * @param {boolean} [props.isLinking=false] - If true, buttons link accounts instead of logging in
 * @param {Function} [props.onError] - Error callback
 * @param {string} [props.buttonText='Sign in with'] - Button text prefix
 * @param {boolean} [props.showDivider=true] - Show "OR" divider
 */
export default function SocialLoginButtons({
  isLinking = false,
  onError,
  buttonText = 'Sign in with',
  showDivider = true
}) {
  const [availableProviders, setAvailableProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Fetch available providers on mount
  useEffect(() => {
    async function fetchProviders() {
      try {
        const providers = await getAvailableProviders();
        setAvailableProviders(providers);
      } catch (error) {
        console.error('Error fetching OAuth providers:', error);
        setAvailableProviders([]);
      } finally {
        setLoading(false);
      }
    }

    fetchProviders();
  }, []);

  const handleSocialLogin = (provider) => {
    const endpoint = isLinking ? `/api/auth/link/${provider}` : `/api/auth/${provider}`;
    window.location.href = `${baseUrl}${endpoint}`;
  };

  // Don't render anything while loading or if no providers available
  if (loading) {
    return null; // Could add a loading spinner here if desired
  }

  if (availableProviders.length === 0) {
    return null; // No OAuth providers configured
  }

  const isFacebookAvailable = availableProviders.includes('facebook');
  const isGoogleAvailable = availableProviders.includes('google');
  const isTwitterAvailable = availableProviders.includes('twitter');

  return (
    <div className="social-login-container">
      {showDivider && (
        <div className="divider my-3">
          <span className="divider-text">OR</span>
        </div>
      )}

      <div className="social-buttons">
        {isFacebookAvailable && (
          <button
            type="button"
            className="social-btn facebook-btn"
            onClick={() => handleSocialLogin('facebook')}
            aria-label={`${buttonText} Facebook`}
          >
            <FaFacebook className="social-icon" />
            <span>{buttonText} Facebook</span>
          </button>
        )}

        {isGoogleAvailable && (
          <button
            type="button"
            className="social-btn google-btn"
            onClick={() => handleSocialLogin('google')}
            aria-label={`${buttonText} Google`}
          >
            <FaGoogle className="social-icon" />
            <span>{buttonText} Google</span>
          </button>
        )}

        {isTwitterAvailable && (
          <button
            type="button"
            className="social-btn twitter-btn"
            onClick={() => handleSocialLogin('twitter')}
            aria-label={`${buttonText} X`}
          >
            <FaXTwitter className="social-icon" />
            <span>{buttonText} X</span>
          </button>
        )}
      </div>
    </div>
  );
}

SocialLoginButtons.propTypes = {
  isLinking: PropTypes.bool,
  onError: PropTypes.func,
  buttonText: PropTypes.string,
  showDivider: PropTypes.bool,
};
