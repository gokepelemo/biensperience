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
 * @param {string} [props.actionType='signin'] - Action type: 'signin' or 'signup'
 * @param {boolean} [props.showDivider=true] - Show "OR" divider
 */
export default function SocialLoginButtons({ 
  isLinking = false, 
  onError, 
  actionType = 'signin',
  showDivider = true 
}) {
  const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  
  // Determine button text based on action type
  const getButtonText = () => {
    return actionType === 'signup' ? 'Sign up with' : 'Sign in with';
  };

  const buttonPrefix = getButtonText();
  
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
          aria-label={`${buttonPrefix} Facebook`}
        >
          <FaFacebook className="social-icon" />
          <span>{buttonPrefix} Facebook</span>
        </button>

        <button
          type="button"
          className="social-btn google-btn"
          onClick={() => handleSocialLogin('google')}
          aria-label={`${buttonPrefix} Google`}
        >
          <FaGoogle className="social-icon" />
          <span>{buttonPrefix} Google</span>
        </button>

        <button
          type="button"
          className="social-btn twitter-btn"
          onClick={() => handleSocialLogin('twitter')}
          aria-label={`${buttonPrefix} X`}
        >
          <FaXTwitter className="social-icon" />
          <span>{buttonPrefix} X</span>
        </button>
      </div>
    </div>
  );
}

SocialLoginButtons.propTypes = {
  isLinking: PropTypes.bool,
  onError: PropTypes.func,
  actionType: PropTypes.oneOf(['signin', 'signup']),
  showDivider: PropTypes.bool,
};
