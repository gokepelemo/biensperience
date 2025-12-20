/**
 * useGeocodedMarkers Hook
 *
 * Generates map markers from destinations and experiences with geocoding fallback.
 * Uses a cache to avoid repeated geocoding requests for the same addresses.
 * Implements race condition prevention with version tracking.
 *
 * @module useGeocodedMarkers
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { geocodeAddressViaAPI } from '../utilities/geocode-api';
import { logger } from '../utilities/logger';

/**
 * Helper function to validate and extract coordinates from a location object
 * @param {Object} location - Location object with geo.coordinates
 * @returns {{ lat: number, lng: number } | null} Coordinates or null if invalid
 */
function extractCoords(location) {
  const geoData = location?.geo;
  if (!geoData?.coordinates || !Array.isArray(geoData.coordinates) || geoData.coordinates.length !== 2) {
    return null;
  }
  const [lng, lat] = geoData.coordinates;
  // Validate coordinates are valid numbers and not zero (which would indicate no data)
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
    return null;
  }
  return { lat, lng };
}

/**
 * Build address string for geocoding fallback
 * @param {Object} item - Destination or experience object
 * @param {'destination' | 'experience'} type - Item type
 * @returns {string} Address string for geocoding
 */
function buildAddressString(item, type) {
  if (type === 'destination') {
    // Use map_location if available, otherwise build from name + country
    if (item.map_location) return item.map_location;
    const parts = [item.name];
    if (item.state) parts.push(item.state);
    if (item.country) parts.push(item.country);
    return parts.join(', ');
  } else {
    // Experience: use destination name + country
    if (item.destination?.name) {
      const parts = [item.destination.name];
      if (item.destination.country) parts.push(item.destination.country);
      return parts.join(', ');
    }
    return item.name; // Fallback to experience name
  }
}

/**
 * Hook to generate map markers from destinations and experiences with geocoding fallback
 *
 * @example
 * const { markers, isLoading, hasData } = useGeocodedMarkers({
 *   destinations: destinationsList,
 *   experiences: experiencesList,
 *   loading: isDataLoading
 * });
 *
 * @param {Object} options - Hook options
 * @param {Array} options.destinations - Array of destination objects
 * @param {Array} options.experiences - Array of experience objects
 * @param {boolean} options.loading - Whether parent data is still loading
 * @param {number} [options.batchSize=5] - Number of geocoding requests per batch
 * @returns {{
 *   markers: Array<{ id: string, lat: number, lng: number, type: string, name: string, photo: string, link: string, locationName: string }>,
 *   isLoading: boolean,
 *   hasData: boolean
 * }}
 */
export default function useGeocodedMarkers({
  destinations = [],
  experiences = [],
  loading = false,
  batchSize = 5
}) {
  const [markers, setMarkers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const geocodeCacheRef = useRef(new Map()); // Cache geocoded results
  const geocodeVersionRef = useRef(0); // Track geocoding version to prevent stale updates

  // Generate markers with geocoding fallback
  useEffect(() => {
    if (loading || (destinations.length === 0 && experiences.length === 0)) {
      setMarkers([]);
      setIsLoading(false);
      return;
    }

    // Increment version to track this specific geocoding run
    const currentVersion = ++geocodeVersionRef.current;
    let isCancelled = false;

    async function generateMarkers() {
      setIsLoading(true);
      const generatedMarkers = [];
      const geocodeQueue = [];

      // Process destinations
      for (const dest of destinations) {
        const coords = extractCoords(dest.location);

        // Build location name for display
        const destLocationName = dest.map_location || (dest.state ? `${dest.state}, ${dest.country}` : dest.country);

        if (coords) {
          generatedMarkers.push({
            id: dest._id,
            lat: coords.lat,
            lng: coords.lng,
            type: 'destination',
            name: dest.name,
            photo: dest.default_photo_id?.url || dest.photos?.[0]?.url,
            link: `/destinations/${dest._id}`,
            locationName: destLocationName
          });
        } else {
          // Queue for geocoding
          const addressStr = buildAddressString(dest, 'destination');
          if (addressStr) {
            geocodeQueue.push({
              id: dest._id,
              type: 'destination',
              name: dest.name,
              photo: dest.default_photo_id?.url || dest.photos?.[0]?.url,
              link: `/destinations/${dest._id}`,
              locationName: destLocationName,
              addressStr
            });
          }
        }
      }

      // Process experiences
      for (const exp of experiences) {
        // Try experience's own location first
        let coords = extractCoords(exp.location);

        // If no experience location, try the destination's location
        if (!coords && exp.destination?.location) {
          coords = extractCoords(exp.destination.location);
        }

        // If still no coords, try plan_items
        if (!coords && exp.plan_items?.length > 0) {
          for (const item of exp.plan_items) {
            coords = extractCoords(item.location);
            if (coords) break;
          }
        }

        // Build location name for display
        const expLocationName = exp.destination?.name || null;

        if (coords) {
          generatedMarkers.push({
            id: exp._id,
            lat: coords.lat,
            lng: coords.lng,
            type: 'experience',
            name: exp.name,
            photo: exp.default_photo_id?.url || exp.photos?.[0]?.url,
            link: `/experiences/${exp._id}`,
            locationName: expLocationName
          });
        } else {
          // Queue for geocoding
          const addressStr = buildAddressString(exp, 'experience');
          if (addressStr) {
            geocodeQueue.push({
              id: exp._id,
              type: 'experience',
              name: exp.name,
              photo: exp.default_photo_id?.url || exp.photos?.[0]?.url,
              link: `/experiences/${exp._id}`,
              locationName: expLocationName,
              addressStr
            });
          }
        }
      }

      // Log what we have before geocoding
      logger.debug('[useGeocodedMarkers] Initial markers from coordinates', {
        markersFromCoords: generatedMarkers.length,
        needGeocoding: geocodeQueue.length
      });

      // Perform geocoding for items without coordinates (in batches)
      for (let i = 0; i < geocodeQueue.length; i += batchSize) {
        if (isCancelled) break;

        const batch = geocodeQueue.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (item) => {
            // Check cache first
            const cached = geocodeCacheRef.current.get(item.addressStr);
            if (cached) {
              return { ...item, coords: cached };
            }

            try {
              const result = await geocodeAddressViaAPI(item.addressStr);
              if (result?.location) {
                geocodeCacheRef.current.set(item.addressStr, result.location);
                return { ...item, coords: result.location };
              }
            } catch (err) {
              logger.warn('[useGeocodedMarkers] Geocoding failed', { address: item.addressStr, error: err.message });
            }
            return null;
          })
        );

        // Add successful geocoded items to markers
        for (const result of results) {
          if (result?.coords) {
            generatedMarkers.push({
              id: result.id,
              lat: result.coords.lat,
              lng: result.coords.lng,
              type: result.type,
              name: result.name,
              photo: result.photo,
              link: result.link,
              locationName: result.locationName
            });
          }
        }
      }

      // Only update state if this is still the current version (prevents stale updates)
      if (!isCancelled && currentVersion === geocodeVersionRef.current) {
        logger.debug('[useGeocodedMarkers] Final markers', {
          total: generatedMarkers.length,
          destinations: generatedMarkers.filter(m => m.type === 'destination').length,
          experiences: generatedMarkers.filter(m => m.type === 'experience').length
        });
        setMarkers(generatedMarkers);
        setIsLoading(false);
      }
    }

    generateMarkers();

    return () => {
      isCancelled = true;
      setIsLoading(false);
    };
  }, [destinations, experiences, loading, batchSize]);

  // Check if we have map data available
  const hasData = markers.length > 0 || isLoading;

  return {
    markers,
    isLoading,
    hasData
  };
}
