import { FaFacebook, FaGoogle } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { Flex, IconButton, VisuallyHidden } from '@chakra-ui/react';
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
 * @param {boolean} [props.disabled=false] - Disable all buttons
 */
export default function SocialLoginButtons({
  isLinking = false,
  onError,
  actionType = 'signin',
  showDivider = true,
  disabled = false,
}) {
  // Use REACT_APP_API_URL if set, otherwise use current origin (works in production where API is same-origin)
  const baseUrl = process.env.REACT_APP_API_URL || window.location.origin;

  // Determine button text based on action type
  const buttonPrefix = actionType === 'signup' ? 'Sign up with' : 'Sign in with';

  const handleSocialLogin = (provider) => {
    const endpoint = isLinking ? `/api/auth/link/${provider}` : `/api/auth/${provider}`;
    window.location.href = `${baseUrl}${endpoint}`;
  };

  const sharedButtonCss = {
    borderRadius: 'full',
    // Explicit square dimensions — prevents global 'form button { width: 100% }'
    // mobile rule from overflowing these icon-only buttons.
    width: { base: '44px', sm: '48px' },
    height: { base: '44px', sm: '48px' },
    minWidth: { base: '44px', sm: '48px' },
    padding: 0,
    flexShrink: 0,
    transition: 'all 0.15s',
    _hover: {
      transform: 'translateY(-1px)',
      boxShadow: '{shadows.md}',
    },
    _active: {
      transform: 'translateY(0)',
      boxShadow: '{shadows.xs}',
    },
  };

  return (
    <Flex
      direction="row"
      justify="center"
      align="center"
      gap={{ base: 3, sm: 4 }}
      w="100%"
      mt={showDivider ? 0 : 2}
    >
      {/* Facebook */}
      <IconButton
        aria-label={`${buttonPrefix} Facebook`}
        variant="ghost"
        size={{ base: 'md', sm: 'lg' }}
        data-social-btn
        onClick={() => handleSocialLogin('facebook')}
        disabled={disabled}
        css={{
          ...sharedButtonCss,
          background: '#0a58ca',
          color: 'white',
          border: '1px solid #0a58ca',
          _hover: {
            ...sharedButtonCss._hover,
            background: '#0a58ca',
            filter: 'brightness(1.05)',
          },
        }}
      >
        <FaFacebook />
      </IconButton>

      {/* Google */}
      <IconButton
        aria-label={`${buttonPrefix} Google`}
        variant="outline"
        size={{ base: 'md', sm: 'lg' }}
        data-social-btn
        onClick={() => handleSocialLogin('google')}
        disabled={disabled}
        css={{
          ...sharedButtonCss,
          background: { _light: '{colors.gray.50}', _dark: '{colors.gray.800}' },
          borderColor: { _light: 'rgba(0, 0, 0, 0.15)', _dark: 'rgba(255, 255, 255, 0.2)' },
          color: 'fg',
          _hover: {
            ...sharedButtonCss._hover,
            background: { _light: '{colors.gray.100}', _dark: '{colors.gray.700}' },
          },
        }}
      >
        <FaGoogle />
      </IconButton>

      {/* X (formerly Twitter) */}
      <IconButton
        aria-label={`${buttonPrefix} X`}
        variant="ghost"
        size={{ base: 'md', sm: 'lg' }}
        data-social-btn
        onClick={() => handleSocialLogin('twitter')}
        disabled={disabled}
        css={{
          ...sharedButtonCss,
          background: '#000',
          color: '#fff',
          border: '1px solid #222',
          _hover: {
            ...sharedButtonCss._hover,
            background: '#000',
            filter: 'brightness(1.1)',
          },
        }}
      >
        <FaXTwitter />
      </IconButton>
    </Flex>
  );
}

SocialLoginButtons.propTypes = {
  isLinking: PropTypes.bool,
  onError: PropTypes.func,
  actionType: PropTypes.oneOf(['signin', 'signup']),
  showDivider: PropTypes.bool,
  disabled: PropTypes.bool,
};
