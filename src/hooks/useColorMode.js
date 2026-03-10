/**
 * useColorMode — Chakra-compatible color mode hook
 *
 * Integrates with theme-manager.js so that both the legacy data-theme
 * attribute and the native Chakra .dark/.light class are kept in sync.
 *
 * API mirrors Chakra v3's useColorMode:
 *   const { colorMode, toggleColorMode, setColorMode } = useColorMode();
 */

import { useState, useEffect, useCallback } from 'react';
import themeManager from '../utilities/theme-manager';

/**
 * Resolve the effective color mode from the DOM.
 * Returns 'dark' or 'light'.
 */
function _getEffectiveMode() {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/**
 * React hook providing Chakra-compatible color mode control.
 *
 * @returns {{ colorMode: 'light'|'dark', toggleColorMode: () => void, setColorMode: (mode: string) => void }}
 */
export function useColorMode() {
  const [colorMode, setColorModeState] = useState(_getEffectiveMode);

  // Keep state in sync with DOM changes (e.g. cross-tab, media query)
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setColorModeState(_getEffectiveMode());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  const setColorMode = useCallback(
    /** @param {'light'|'dark'|'system-default'} mode */
    (mode) => {
      themeManager.applyTheme(mode);
      setColorModeState(_getEffectiveMode());
    },
    [],
  );

  const toggleColorMode = useCallback(() => {
    const next = _getEffectiveMode() === 'dark' ? 'light' : 'dark';
    setColorMode(next);
  }, [setColorMode]);

  return { colorMode, toggleColorMode, setColorMode };
}

/**
 * Returns one of two values based on current color mode.
 * Mirrors Chakra v3's useColorModeValue.
 *
 * @template T
 * @param {T} lightValue - Value for light mode
 * @param {T} darkValue  - Value for dark mode
 * @returns {T}
 */
export function useColorModeValue(lightValue, darkValue) {
  const { colorMode } = useColorMode();
  return colorMode === 'dark' ? darkValue : lightValue;
}

export default useColorMode;
