import React from 'react';
import { FaFacebook, FaGoogle } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import './SocialLoginButtons.css';
import PropTypes from 'prop-types';

/**
 * Social Login Buttons Component
 * Displays OAuth login buttons for Facebook, Google, and X (formerly Twitter)
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
  const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  
  const handleSocialLogin = (provider) => {
    const endpoint = isLinking ? `/api/auth/link/${provider}` : `/api/auth/${provider}`;
    window.location.href = `${baseUrl}${endpoint}`;
  };

  return (
    <div className="social-login-container">
      {showDivider && (
        <div className="divider my-3">
          <span className="divider-text">OR</span>
        </div>
      )}
      
      <div className="social-buttons">
        <button
          type="button"
          className="social-btn facebook-btn"
          onClick={() => handleSocialLogin('facebook')}
          aria-label={`${buttonText} Facebook`}
        >
          <FaFacebook className="social-icon" />
          <span>{buttonText} Facebook</span>
        </button>

        <button
          type="button"
          className="social-btn google-btn"
          onClick={() => handleSocialLogin('google')}
          aria-label={`${buttonText} Google`}
        >
          <FaGoogle className="social-icon" />
          <span>{buttonText} Google</span>
        </button>

        <button
          type="button"
          className="social-btn twitter-btn"
          onClick={() => handleSocialLogin('twitter')}
          aria-label={`${buttonText} X`}
        >
          <FaXTwitter className="social-icon" />
          <span>{buttonText} X</span>
        </button>
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
