/**
 * SkipLink — Accessible navigation skip link (Chakra UI v3 native)
 *
 * WCAG 2.1 SC 2.4.1 Bypass Blocks — Hidden by default, visible only on
 * keyboard focus. Allows keyboard users to jump past repetitive navigation.
 *
 * Task: biensperience-dd5f — P4.1 App view & global layout → Chakra
 */

import React from 'react';
import PropTypes from 'prop-types';
import { chakra } from '@chakra-ui/react';

const StyledLink = chakra('a', {
  base: {
    /* Visually hidden by default */
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
    border: 0,

    /* Visible when focused */
    _focusVisible: {
      position: 'fixed',
      top: '3',
      left: '3',
      zIndex: 'tooltip',
      width: 'auto',
      height: 'auto',
      padding: '3 6',
      margin: 0,
      overflow: 'visible',
      clipPath: 'none',
      background: 'linear-gradient(135deg, {colors.brand.500}, {colors.brand.600})',
      color: 'white',
      textDecoration: 'none',
      borderRadius: 'md',
      fontWeight: 'semibold',
      fontSize: 'sm',
      boxShadow: 'lg',
      outline: '3px solid white',
      outlineOffset: '2px',
    },
  },
});

/**
 * SkipLink — keyboard-accessible skip-to-content link
 *
 * @param {Object} props
 * @param {string} [props.href] — Target anchor (default: '#main-content')
 * @param {React.ReactNode} [props.children] — Link text
 */
export default function SkipLink({ href = '#main-content', children = 'Skip to main content' }) {
  return (
    <StyledLink href={href}>
      {children}
    </StyledLink>
  );
}

SkipLink.displayName = 'SkipLink';

SkipLink.propTypes = {
  href: PropTypes.string,
  children: PropTypes.node,
};
