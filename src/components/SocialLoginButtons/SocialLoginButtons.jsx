import React from 'react';
import { FaFacebook, FaGoogle } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import styles from './SocialLoginButtons.module.scss';
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
    <div className={styles.socialLoginContainer}>
      {showDivider && (
        <div className={`${styles.divider} my-3`}>
          <span className={styles.dividerText}>OR</span>
        </div>
      )}

      <div className={styles.socialButtons}>
        <button
          type="button"
          className={`${styles.socialBtn} ${styles.facebookBtn}`}
          onClick={() => handleSocialLogin('facebook')}
          aria-label={`${buttonPrefix} Facebook`}
        >
          <FaFacebook className={styles.socialIcon} />
          <span>{buttonPrefix} Facebook</span>
        </button>

        <button
          type="button"
          className={`${styles.socialBtn} ${styles.googleBtn}`}
          onClick={() => handleSocialLogin('google')}
          aria-label={`${buttonPrefix} Google`}
        >
          <FaGoogle className={styles.socialIcon} />
          <span>{buttonPrefix} Google</span>
        </button>

        <button
          type="button"
          className={`${styles.socialBtn} ${styles.twitterBtn}`}
          onClick={() => handleSocialLogin('twitter')}
          aria-label={`${buttonPrefix} X`}
        >
          <FaXTwitter className={styles.socialIcon} />
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
