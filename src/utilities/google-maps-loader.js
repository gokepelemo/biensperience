/**
 * Google Maps Loader Utility
 *
 * Provides a shared loader for the Google Maps JavaScript SDK with Places library.
 * Ensures the SDK is only loaded once and provides access to the Places services.
 *
 * IMPORTANT: This utility works alongside @react-google-maps/api which loads Google Maps.
 * We do NOT use @googlemaps/js-api-loader because it conflicts with @react-google-maps/api.
 * Instead, we wait for Google Maps to be loaded by the InteractiveMap component.
 *
 * @module google-maps-loader
 */

import { logger } from './logger';

// Google Maps API key from environment variable (Vite)
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Cached places library
let placesLibrary = null;
let loadPromise = null;

// Services (created after load)
let autocompleteService = null;
let placesService = null;
let placesServiceElement = null;

/**
 * Wait for Google Maps Places to be available
 * The Places library is loaded by @react-google-maps/api in InteractiveMap
 *
 * @param {number} timeout - Maximum time to wait in ms
 * @returns {Promise<boolean>} True if google.maps.places is available
 */
function waitForGoogleMapsPlaces(timeout = 10000) {
  return new Promise((resolve) => {
    // Already available
    if (window.google?.maps?.places) {
      resolve(true);
      return;
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (window.google?.maps?.places) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        resolve(false);
      }
    }, 100);
  });
}

/**
 * Load Google Maps script dynamically if not already loaded
 * This is a fallback when @react-google-maps/api hasn't loaded the SDK yet
 */
function loadGoogleMapsScript() {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (window.google?.maps) {
      resolve();
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existingScript) {
      // Wait for it to load
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Google Maps script failed to load')));
      return;
    }

    // Load the script ourselves
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=__googleMapsCallback`;
    script.async = true;
    script.defer = true;

    // Setup callback
    window.__googleMapsCallback = () => {
      delete window.__googleMapsCallback;
      resolve();
    };

    script.onerror = () => {
      delete window.__googleMapsCallback;
      reject(new Error('Google Maps script failed to load'));
    };

    document.head.appendChild(script);
  });
}

/**
 * Load the Google Maps Places library
 * Returns the places library namespace once loaded
 *
 * @returns {Promise<google.maps.places>} The google.maps.places namespace
 */
export async function loadPlacesLibrary() {
  // Return cached instance if already loaded
  if (placesLibrary) {
    return placesLibrary;
  }

  // Return existing promise if load is in progress
  if (loadPromise) {
    return loadPromise;
  }

  // Start loading
  loadPromise = (async () => {
    try {
      if (!GOOGLE_MAPS_API_KEY) {
        throw new Error('Google Maps API key is not configured (VITE_GOOGLE_MAPS_API_KEY)');
      }

      // Check if Google Maps Places is already loaded
      if (window.google?.maps?.places) {
        logger.debug('[google-maps-loader] Using existing Google Maps Places library');
        placesLibrary = window.google.maps.places;
        return placesLibrary;
      }

      // Wait for it to be loaded by @react-google-maps/api (InteractiveMap)
      logger.debug('[google-maps-loader] Waiting for Google Maps Places library...');
      const loaded = await waitForGoogleMapsPlaces(3000);

      if (loaded && window.google?.maps?.places) {
        logger.debug('[google-maps-loader] Using Google Maps Places library (loaded by @react-google-maps/api)');
        placesLibrary = window.google.maps.places;
        return placesLibrary;
      }

      // Try using google.maps.importLibrary if Google Maps core is loaded but places isn't
      if (window.google?.maps?.importLibrary) {
        logger.debug('[google-maps-loader] Using google.maps.importLibrary()...');
        try {
          placesLibrary = await window.google.maps.importLibrary('places');
          if (placesLibrary) {
            logger.debug('[google-maps-loader] Places library loaded via google.maps.importLibrary');
            return placesLibrary;
          }
        } catch (importError) {
          logger.debug('[google-maps-loader] google.maps.importLibrary failed', {
            error: importError?.message
          });
        }
      }

      // Fallback: Load Google Maps ourselves via script tag
      logger.debug('[google-maps-loader] Loading Google Maps via script tag...');
      await loadGoogleMapsScript();

      // Wait for places library to be available
      await waitForGoogleMapsPlaces(5000);

      if (window.google?.maps?.places) {
        logger.debug('[google-maps-loader] Places library loaded via script tag');
        placesLibrary = window.google.maps.places;
        return placesLibrary;
      }

      throw new Error('Google Maps Places library failed to load');
    } catch (error) {
      const errorMessage = error?.message || error?.toString?.() || 'Unknown error';
      logger.error('[google-maps-loader] Failed to load Google Maps SDK', {
        error: errorMessage,
        apiKeyPresent: !!GOOGLE_MAPS_API_KEY
      });
      loadPromise = null; // Allow retry
      throw error;
    }
  })();

  return loadPromise;
}

/**
 * Get the AutocompleteService instance
 * Creates one if it doesn't exist
 *
 * @returns {Promise<google.maps.places.AutocompleteService>}
 */
export async function getAutocompleteService() {
  if (autocompleteService) {
    return autocompleteService;
  }

  const places = await loadPlacesLibrary();
  autocompleteService = new places.AutocompleteService();
  return autocompleteService;
}

/**
 * Get the PlacesService instance
 * Creates one if it doesn't exist (uses a hidden div as required by the API)
 *
 * @returns {Promise<google.maps.places.PlacesService>}
 */
export async function getPlacesService() {
  if (placesService) {
    return placesService;
  }

  const places = await loadPlacesLibrary();

  // PlacesService requires a map or HTMLDivElement
  // Create a hidden div for the service
  if (!placesServiceElement) {
    placesServiceElement = document.createElement('div');
    placesServiceElement.style.display = 'none';
    document.body.appendChild(placesServiceElement);
  }

  placesService = new places.PlacesService(placesServiceElement);
  return placesService;
}

/**
 * Check if Google Maps Places library is loaded
 * @returns {boolean}
 */
export function isPlacesLibraryLoaded() {
  return placesLibrary !== null;
}

/**
 * Preload Google Maps Places library
 * Call this early in app lifecycle to reduce latency on first use
 */
export function preloadPlacesLibrary() {
  loadPlacesLibrary().catch(() => {
    // Silently ignore preload errors - will retry on actual use
  });
}
