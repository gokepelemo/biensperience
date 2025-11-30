/**
 * transportUtils.js
 * Helper utilities to query `transportVendors.json` and build tracking URLs.
 */
/**
 * @fileoverview Utilities for transport vendor lookup and realtime tracking helpers.
 *
 * This module exposes helpers to read the canonical `transportVendors.json`,
 * build tracking URLs, and a realtime flight tracker using the AviationStack API.
 *
 * It provides a normalized flight response shape to make it easy for frontends
 * and downstream agents to consume flight status information.
 */

/**
 * @example
 * // Simple Node usage
 * const { trackTransport } = require('./src/utilities/transportUtils');
 * (async () => {
 *   // returns the normalized AviationNormalizedResult object
 *   const res = await trackTransport({ type: 'flight', country: 'US', vendorName: 'United Airlines', trackingNumber: 'UA2402' });
 *   if (res.error) console.error('Track error', res);
 *   else console.log('Flight status', res.status, res.airline, res.flight);
 * })();
 *
 * @example
 * // React + Modal example (pseudo-code)
 * // Show a modal with flight details. If the flight is 'active' show an embedded map.
 * import React, { useState } from 'react';
 * import { Modal, Button } from 'your-ui-library';
 * import { trackTransport } from '../../utilities/transportUtils';
 *
 * function FlightModal({ flightId, show, onClose }) {
 *   const [flight, setFlight] = useState(null);
 *   const [loading, setLoading] = useState(false);
 *
 *   React.useEffect(() => {
 *     if (!show) return;
 *     (async () => {
 *       setLoading(true);
 *       const r = await trackTransport({ type: 'flight', country: 'US', vendorName: 'United Airlines', trackingNumber: flightId });
 *       setFlight(r);
 *       setLoading(false);
 *     })();
 *   }, [show, flightId]);
 *
 *   return (
 *     <Modal show={show} onHide={onClose} title={flight ? `${flight.airline?.name} ${flight.flight?.iata || flight.flight?.number}` : 'Flight'}>
 *       {loading && <div>Loading…</div>}
 *       {!loading && flight && (
 *         <div>
 *           <p><strong>Status:</strong> {flight.status}</p>
 *           <p><strong>From:</strong> {flight.departure?.airport} ({flight.departure?.iata})</p>
 *           <p><strong>To:</strong> {flight.arrival?.airport} ({flight.arrival?.iata})</p>
 *           <p><strong>Scheduled:</strong> {flight.departure?.scheduled}</p>
 *           <p><strong>Estimated:</strong> {flight.departure?.estimated}</p>
 *           <p><strong>Actual:</strong> {flight.departure?.actual}</p>
 *
 *           // If flight is active/in-progress, embed a map.
 *           // Note: Avoid using JSX-style comment tokens inside JSDoc examples
 *           // because they can close the comment block unexpectedly.
 *           // Use plain code or JS comments in examples instead.
 *           if (flight.status === 'active') {
 *             // Example: render a map container. AviationStack may not return
 *             // live coordinates; prefer using an airport->latlng lookup or
 *             // a separate live-positions data source.
 *             // <div style={{ height: 400 }}>
 *             //   <GoogleMap center={getAirportLatLng(flight.departure.iata)} />
 *             // </div>
 *           }
 *
 *           // Show raw payload for debugging (optional)
 *           // <pre style={{ maxHeight: 200, overflow: 'auto' }}>{JSON.stringify(flight.raw, null, 2)}</pre>
 *         </div>
 *       )}
 *     </Modal>
 *   );
 * }
 *
 * @example
 * // Notes:
 * // - The normalized object includes `departure` and `arrival` times as strings
 * //   exactly as returned by AviationStack. Convert to Date objects in the UI
 * //   if you need timezone-aware formatting.
 * // - To show a moving aircraft on a map you will need live coordinates from
 * //   a source that provides position data, or approximate the position using
 * //   scheduled/estimated times and airport coordinates.
 */
/**
 * Normalized types (JSDoc typedefs)
 *
 * @typedef {Object} AviationNormalizedPoint
 * @property {string|null} airport - Human readable airport name
 * @property {string|null} iata - IATA code (e.g. LAX)
 * @property {string|null} icao - ICAO code
 * @property {string|null} scheduled - Scheduled time string (as returned by API)
 * @property {string|null} estimated - Estimated time string (as returned by API)
 * @property {string|null} actual - Actual time string (as returned by API)
 * @property {string|null} terminal - Terminal identifier (if available)
 * @property {string|null} gate - Gate identifier (if available)
 * @property {number|null} delay - Delay in minutes (if provided)
 * @property {string|null} timezone - Timezone string for the airport/time
 * @property {number|null} scheduled_ts - Scheduled time as epoch ms (or null)
 * @property {number|null} estimated_ts - Estimated time as epoch ms (or null)
 * @property {number|null} actual_ts - Actual time as epoch ms (or null)
 *
 * @typedef {Object} AviationNormalizedAirline
 * @property {string|null} name
 * @property {string|null} iata
 * @property {string|null} icao
 *
 * @typedef {Object} AviationNormalizedFlightIdentity
 * @property {string|null} number - Canonical flight number (e.g. 100 or DL100)
 * @property {string|null} iata
 * @property {string|null} icao
 *
 * @typedef {Object} AviationNormalizedAircraft
 * @property {string|null} model - Aircraft model (if available)
 * @property {string|null} registration - Tail/registration
 * @property {string|null} iata - Aircraft IATA code
 * @property {string|null} icao - Aircraft ICAO code
 *
 * @typedef {Object} AviationNormalizedResult
 * @property {string|null} status - Flight status (e.g. scheduled, active, landed) or 'not_found'/'unknown'
 * @property {AviationNormalizedAirline|null} airline
 * @property {AviationNormalizedFlightIdentity|null} flight
 * @property {AviationNormalizedAircraft|null} aircraft
 * @property {AviationNormalizedPoint|null} departure
 * @property {AviationNormalizedPoint|null} arrival
 * @property {Object} raw - Raw API response for debugging/inspection
 */

const path = require('path');
const fs = require('fs');

const VENDORS_PATH = path.join(__dirname, 'transportVendors.json');

// ============================================================================
// TRANSPORT MODE CONSTANTS AND EXTENSION SCHEMAS
// ============================================================================

/**
 * Enumeration of supported transport modes
 * @constant {Object}
 */
const TRANSPORT_MODES = {
  FLIGHT: 'flight',
  TRAIN: 'train',
  CRUISE: 'cruise',
  FERRY: 'ferry',
  BUS: 'bus',
  COACH: 'coach',
  CAR_SHARE: 'car_share',
  RIDE: 'ride',
  METRO: 'metro',
  LOCAL_TRANSIT: 'local_transit',
  BIKE_RENTAL: 'bike_rental',
  SCOOTER: 'scooter'
};

/**
 * Transport mode categories for grouping related modes
 * @constant {Object}
 */
const TRANSPORT_CATEGORIES = {
  AIR: ['flight'],
  RAIL: ['train', 'metro', 'local_transit'],
  WATER: ['cruise', 'ferry'],
  ROAD: ['bus', 'coach', 'car_share', 'ride'],
  MICRO_MOBILITY: ['bike_rental', 'scooter']
};

/**
 * Base transport schema fields common to all modes
 * @typedef {Object} BaseTransportExtension
 * @property {string} mode - Transport mode (from TRANSPORT_MODES)
 * @property {string} [vendor] - Transport vendor/carrier name
 * @property {string} [trackingNumber] - Booking/confirmation/tracking number
 * @property {string} [country] - Country code (ISO 3166-1 alpha-2)
 * @property {Date|string} [departureTime] - Scheduled departure time
 * @property {Date|string} [arrivalTime] - Scheduled arrival time
 * @property {string} [departureLocation] - Departure point name/address
 * @property {string} [arrivalLocation] - Arrival point name/address
 * @property {string} [status] - Current status (scheduled, active, completed, cancelled, delayed)
 * @property {string} [notes] - User notes
 */

/**
 * Flight-specific extension fields (minimal - for collaborator tracking)
 * @typedef {Object} FlightExtension
 * @property {'flight'} mode
 * @property {string} [terminal] - Departure terminal
 * @property {string} [arrivalTerminal] - Arrival terminal
 * @property {string} [gate] - Departure gate
 * @property {string} [arrivalGate] - Arrival gate
 */
const FLIGHT_EXTENSION_SCHEMA = {
  mode: { type: 'string', enum: ['flight'], required: true },
  terminal: { type: 'string' },
  arrivalTerminal: { type: 'string' },
  gate: { type: 'string' },
  arrivalGate: { type: 'string' }
};

/**
 * Train-specific extension fields (minimal - for collaborator tracking)
 * @typedef {Object} TrainExtension
 * @property {'train'} mode
 * @property {string} [carriageNumber] - Car/carriage number
 * @property {string} [platform] - Departure platform
 * @property {string} [arrivalPlatform] - Arrival platform
 */
const TRAIN_EXTENSION_SCHEMA = {
  mode: { type: 'string', enum: ['train'], required: true },
  carriageNumber: { type: 'string' },
  platform: { type: 'string' },
  arrivalPlatform: { type: 'string' }
};

/**
 * Cruise/Ferry-specific extension fields (minimal - for collaborator tracking)
 * @typedef {Object} CruiseFerryExtension
 * @property {'cruise'|'ferry'} mode
 * @property {string} [deck] - Deck level/name
 * @property {string} [shipName] - Name of the vessel
 * @property {string} [embarkationPort] - Port of embarkation
 * @property {string} [disembarkationPort] - Port of disembarkation
 */
const CRUISE_FERRY_EXTENSION_SCHEMA = {
  mode: { type: 'string', enum: ['cruise', 'ferry'], required: true },
  deck: { type: 'string' },
  shipName: { type: 'string' },
  embarkationPort: { type: 'string' },
  disembarkationPort: { type: 'string' }
};

/**
 * Bus/Coach-specific extension fields (minimal - for collaborator tracking)
 * @typedef {Object} BusCoachExtension
 * @property {'bus'|'coach'} mode
 * @property {string} [stopName] - Bus stop/station name
 * @property {string} [arrivalStopName] - Arrival stop/station name
 */
const BUS_COACH_EXTENSION_SCHEMA = {
  mode: { type: 'string', enum: ['bus', 'coach'], required: true },
  stopName: { type: 'string' },
  arrivalStopName: { type: 'string' }
};

/**
 * Car Share/Ride-specific extension fields (minimal - for collaborator tracking)
 * @typedef {Object} CarShareRideExtension
 * @property {'car_share'|'ride'} mode
 * @property {string} [vehicleModel] - Vehicle make/model
 * @property {string} [vehicleColor] - Vehicle color
 * @property {string} [licensePlate] - License plate number
 * @property {string} [pickupSpot] - Specific pickup location/instructions
 */
const CAR_SHARE_RIDE_EXTENSION_SCHEMA = {
  mode: { type: 'string', enum: ['car_share', 'ride'], required: true },
  vehicleModel: { type: 'string' },
  vehicleColor: { type: 'string' },
  licensePlate: { type: 'string' },
  pickupSpot: { type: 'string' }
};

/**
 * Metro/Local Transit-specific extension fields (minimal - for collaborator tracking)
 * @typedef {Object} MetroLocalTransitExtension
 * @property {'metro'|'local_transit'} mode
 * @property {string} [lineNumber] - Line/route number or name
 * @property {string} [direction] - Direction (e.g., 'Northbound', 'Downtown')
 * @property {string} [platform] - Platform number/letter
 */
const METRO_LOCAL_TRANSIT_EXTENSION_SCHEMA = {
  mode: { type: 'string', enum: ['metro', 'local_transit'], required: true },
  lineNumber: { type: 'string' },
  direction: { type: 'string' },
  platform: { type: 'string' }
};

/**
 * Bike Rental/Scooter-specific extension fields (minimal - for collaborator tracking)
 * @typedef {Object} BikeScooterExtension
 * @property {'bike_rental'|'scooter'} mode
 * @property {string} [dockName] - Dock/station name for pickup
 * @property {string} [returnDockName] - Expected return dock/station name
 */
const BIKE_SCOOTER_EXTENSION_SCHEMA = {
  mode: { type: 'string', enum: ['bike_rental', 'scooter'], required: true },
  dockName: { type: 'string' },
  returnDockName: { type: 'string' }
};

/**
 * Map of transport modes to their extension schemas
 * @constant {Object}
 */
const TRANSPORT_EXTENSION_SCHEMAS = {
  flight: FLIGHT_EXTENSION_SCHEMA,
  train: TRAIN_EXTENSION_SCHEMA,
  cruise: CRUISE_FERRY_EXTENSION_SCHEMA,
  ferry: CRUISE_FERRY_EXTENSION_SCHEMA,
  bus: BUS_COACH_EXTENSION_SCHEMA,
  coach: BUS_COACH_EXTENSION_SCHEMA,
  car_share: CAR_SHARE_RIDE_EXTENSION_SCHEMA,
  ride: CAR_SHARE_RIDE_EXTENSION_SCHEMA,
  metro: METRO_LOCAL_TRANSIT_EXTENSION_SCHEMA,
  local_transit: METRO_LOCAL_TRANSIT_EXTENSION_SCHEMA,
  bike_rental: BIKE_SCOOTER_EXTENSION_SCHEMA,
  scooter: BIKE_SCOOTER_EXTENSION_SCHEMA
};

/**
 * Base transport extension schema - common fields for all modes
 * @constant {Object}
 */
const BASE_TRANSPORT_EXTENSION_SCHEMA = {
  mode: { type: 'string', enum: Object.values(TRANSPORT_MODES), required: true },
  vendor: { type: 'string' },
  trackingNumber: { type: 'string' },
  country: { type: 'string', maxLength: 2 },
  departureTime: { type: 'date' },
  arrivalTime: { type: 'date' },
  departureLocation: { type: 'string' },
  arrivalLocation: { type: 'string' },
  status: { type: 'string', enum: ['scheduled', 'active', 'completed', 'cancelled', 'delayed', null] },
  notes: { type: 'string' }
};

/**
 * Get the extension schema for a specific transport mode
 * @param {string} mode - Transport mode
 * @returns {Object|null} Extension schema or null if mode not found
 */
function getTransportExtensionSchema(mode) {
  if (!mode) return null;
  const normalized = String(mode).toLowerCase().replace(/[-\s]/g, '_');
  return TRANSPORT_EXTENSION_SCHEMAS[normalized] || null;
}

/**
 * Get all valid fields for a transport mode (base + mode-specific)
 * @param {string} mode - Transport mode
 * @returns {Object} Combined schema with base and mode-specific fields
 */
function getFullTransportSchema(mode) {
  const modeSchema = getTransportExtensionSchema(mode);
  if (!modeSchema) {
    return { ...BASE_TRANSPORT_EXTENSION_SCHEMA };
  }
  return { ...BASE_TRANSPORT_EXTENSION_SCHEMA, ...modeSchema };
}

/**
 * Validate a transport extension object against its schema
 * @param {Object} data - Transport extension data to validate
 * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
 */
function validateTransportExtension(data) {
  const result = { valid: true, errors: [], warnings: [] };

  if (!data || typeof data !== 'object') {
    result.valid = false;
    result.errors.push('Transport extension must be an object');
    return result;
  }

  if (!data.mode) {
    result.valid = false;
    result.errors.push('Transport mode is required');
    return result;
  }

  const schema = getFullTransportSchema(data.mode);
  if (!schema) {
    result.valid = false;
    result.errors.push(`Unknown transport mode: ${data.mode}`);
    return result;
  }

  // Validate each field against schema
  for (const [key, fieldSchema] of Object.entries(schema)) {
    const value = data[key];

    // Check required fields
    if (fieldSchema.required && (value === undefined || value === null || value === '')) {
      result.valid = false;
      result.errors.push(`Field '${key}' is required`);
      continue;
    }

    // Skip validation if value is not provided
    if (value === undefined || value === null) continue;

    // Type validation
    if (fieldSchema.type === 'string' && typeof value !== 'string') {
      result.valid = false;
      result.errors.push(`Field '${key}' must be a string`);
    } else if (fieldSchema.type === 'number' && typeof value !== 'number') {
      result.valid = false;
      result.errors.push(`Field '${key}' must be a number`);
    } else if (fieldSchema.type === 'boolean' && typeof value !== 'boolean') {
      result.valid = false;
      result.errors.push(`Field '${key}' must be a boolean`);
    } else if (fieldSchema.type === 'array' && !Array.isArray(value)) {
      result.valid = false;
      result.errors.push(`Field '${key}' must be an array`);
    } else if (fieldSchema.type === 'date' && !(value instanceof Date) && isNaN(Date.parse(value))) {
      result.valid = false;
      result.errors.push(`Field '${key}' must be a valid date`);
    }

    // Enum validation
    if (fieldSchema.enum && !fieldSchema.enum.includes(value) && value !== null) {
      result.valid = false;
      result.errors.push(`Field '${key}' must be one of: ${fieldSchema.enum.filter(e => e !== null).join(', ')}`);
    }

    // Range validation for numbers
    if (fieldSchema.type === 'number' && typeof value === 'number') {
      if (fieldSchema.min !== undefined && value < fieldSchema.min) {
        result.valid = false;
        result.errors.push(`Field '${key}' must be at least ${fieldSchema.min}`);
      }
      if (fieldSchema.max !== undefined && value > fieldSchema.max) {
        result.valid = false;
        result.errors.push(`Field '${key}' must be at most ${fieldSchema.max}`);
      }
    }

    // String length validation
    if (fieldSchema.type === 'string' && typeof value === 'string') {
      if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
        result.valid = false;
        result.errors.push(`Field '${key}' must be at most ${fieldSchema.maxLength} characters`);
      }
    }
  }

  // Warn about unknown fields
  const knownFields = new Set(Object.keys(schema));
  for (const key of Object.keys(data)) {
    if (!knownFields.has(key)) {
      result.warnings.push(`Unknown field '${key}' for mode '${data.mode}'`);
    }
  }

  return result;
}

/**
 * Create a transport extension object with defaults
 * @param {string} mode - Transport mode
 * @param {Object} [data={}] - Initial data
 * @returns {Object} Transport extension object with mode set
 */
function createTransportExtension(mode, data = {}) {
  if (!mode || !Object.values(TRANSPORT_MODES).includes(mode.toLowerCase().replace(/[-\s]/g, '_'))) {
    throw new Error(`Invalid transport mode: ${mode}`);
  }

  const normalizedMode = mode.toLowerCase().replace(/[-\s]/g, '_');
  return {
    mode: normalizedMode,
    ...data
  };
}

/**
 * Get the category for a transport mode
 * @param {string} mode - Transport mode
 * @returns {string|null} Category name or null if not found
 */
function getTransportCategory(mode) {
  if (!mode) return null;
  const normalized = mode.toLowerCase().replace(/[-\s]/g, '_');

  for (const [category, modes] of Object.entries(TRANSPORT_CATEGORIES)) {
    if (modes.includes(normalized)) {
      return category;
    }
  }
  return null;
}

/**
 * Get all transport modes in a category
 * @param {string} category - Category name (AIR, RAIL, WATER, ROAD, MICRO_MOBILITY)
 * @returns {string[]} Array of transport modes
 */
function getModesInCategory(category) {
  if (!category) return [];
  const upper = category.toUpperCase();
  return TRANSPORT_CATEGORIES[upper] || [];
}

function loadVendors() {
  try {
    const raw = fs.readFileSync(VENDORS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    // Fallback to empty object to avoid throwing in UI contexts
    return {};
  }
}

const vendors = loadVendors();

function normalizeCountry(country) {
  if (!country) return null;
  return String(country).toUpperCase();
}

function listCountries() {
  return Object.keys(vendors);
}

function listTransportTypes(country) {
  const iso = normalizeCountry(country);
  if (!iso || !vendors[iso]) return [];
  return Object.keys(vendors[iso]);
}

function listVendors(country, type) {
  const iso = normalizeCountry(country);
  if (!iso || !vendors[iso]) return [];
  const entry = vendors[iso][type];
  if (!Array.isArray(entry)) return [];
  return entry.map(v => ({ ...v }));
}

function findVendor(country, type, vendorName) {
  const list = listVendors(country, type);
  if (!vendorName) return null;
  const lower = String(vendorName).toLowerCase();
  return list.find(v => v.name && v.name.toLowerCase() === lower) || null;
}

function buildTrackingUrl({ country, type, vendorName, trackingNumber }) {
  if (!trackingNumber) return null;
  const iso = normalizeCountry(country);
  if (!iso || !vendors[iso]) return null;

  const typeList = vendors[iso][type];
  if (!Array.isArray(typeList)) return null;

  // Try to find exact vendor match first
  let vendor = null;
  if (vendorName) {
    vendor = findVendor(iso, type, vendorName);
  }

  // Fallback to first vendor with a tracking_url_template
  if (!vendor) {
    vendor = typeList.find(v => v.tracking_url_template) || typeList[0] || null;
  }

  if (!vendor) return null;

  const tpl = vendor.tracking_url_template;
  if (!tpl) {
    // If no template, return vendor.url (best-effort) with tracking as query
    try {
      const url = new URL(vendor.url);
      url.searchParams.set('q', trackingNumber);
      return url.toString();
    } catch (err) {
      return vendor.url || null;
    }
  }

  // Replace placeholder {tracking_number} (case-insensitive)
  const encoded = encodeURIComponent(trackingNumber);
  return tpl.replace(/\{tracking_number\}/ig, encoded);
}

// Normalize aviationstack API response into a small canonical shape
function normalizeAviationstackResponse(apiResponse) {
  // apiResponse expected shape: { data: [ { flight_status, departure: {...}, arrival: {...}, ... }, ... ] }
  if (!apiResponse) return { status: 'unknown', departure: null, arrival: null, raw: apiResponse };
  const data = Array.isArray(apiResponse.data) ? apiResponse.data : null;
  if (!data || data.length === 0) return { status: 'not_found', departure: null, arrival: null, raw: apiResponse };

  const f = data[0];
  const status = f.flight_status || f.status || null;

  const mapPoint = (pt) => {
    if (!pt) return null;
    const parseMs = (s) => {
      if (!s) return null;
      const v = Date.parse(s);
      return Number.isNaN(v) ? null : v;
    };

    return {
      airport: pt.airport || pt.airport_name || null,
      iata: pt.iata || null,
      icao: pt.icao || null,
      scheduled: pt.scheduled || null,
      scheduled_ts: parseMs(pt.scheduled),
      estimated: pt.estimated || null,
      estimated_ts: parseMs(pt.estimated),
      actual: pt.actual || null,
      actual_ts: parseMs(pt.actual),
      terminal: pt.terminal || null,
      gate: pt.gate || null,
      delay: pt.delay != null ? pt.delay : null,
      timezone: pt.timezone || null,
    };
  };

  const departure = mapPoint(f.departure);
  const arrival = mapPoint(f.arrival);

  // Airline metadata (defensive)
  const airline = (f.airline || f.airline_name) ? {
    name: (f.airline && f.airline.name) || f.airline_name || null,
    iata: (f.airline && f.airline.iata) || null,
    icao: (f.airline && f.airline.icao) || null,
  } : null;

  // Flight identity metadata (defensive)
  const flight = (f.flight || f.flight_number || f.flight_iata) ? {
    // Prefer explicit flight.number, fall back to flight.iata or other fields
    number: (f.flight && (f.flight.number || f.flight.iata)) || f.flight_number || f.flight_iata || null,
    iata: (f.flight && f.flight.iata) || null,
    icao: (f.flight && f.flight.icao) || null,
  } : null;

  // Aircraft metadata (if present)
  const aircraft = (f.aircraft || f.aircraft_model || f.aircraft_reg) ? {
    model: (f.aircraft && (f.aircraft.model || f.aircraft.name)) || f.aircraft_model || null,
    registration: (f.aircraft && (f.aircraft.registration || f.aircraft.reg)) || f.aircraft_reg || null,
    iata: (f.aircraft && f.aircraft.iata) || null,
    icao: (f.aircraft && f.aircraft.icao) || null,
  } : null;

  // For clarity, expose terminal/gate times under clear keys (they already exist
  // on departure/arrival as scheduled/estimated/actual but some callers prefer
  // explicit names). We'll keep original scheduled/estimated/actual fields
  // and not duplicate timestamps; the `departure`/`arrival` objects include them.

  return { status, airline, flight, aircraft, departure, arrival, raw: apiResponse };
}

module.exports = {
  listCountries,
  listTransportTypes,
  listVendors,
  findVendor,
  buildTrackingUrl,
  // Async tracking helpers
  async trackFlightRealtime(country, vendorName, trackingNumber) {
    // Wrapper for aviationstack API. Requires env var `AVIATIONSTACK_KEY`.
    const key = process.env.AVIATIONSTACK_KEY;
    if (!key) {
      return { error: 'MISSING_API_KEY', message: 'Set process.env.AVIATIONSTACK_KEY to use realtime flight tracking' };
    }

    if (!trackingNumber) return { error: 'MISSING_TRACKING_NUMBER' };

    // Try common aviationstack query params. Prefer flight_iata (e.g. DL123).
    const qs = new URLSearchParams({ access_key: key, flight_iata: trackingNumber });
    const base = 'http://api.aviationstack.com/v1/flights';

    try {
      const url = `${base}?${qs.toString()}`;
      const res = await makeGetRequest(url);
      // If we have data, normalize and return canonical object
      if (res && Array.isArray(res.data) && res.data.length > 0) {
        return normalizeAviationstackResponse(res);
      }

      // Fallback: try flight_number param
      const qs2 = new URLSearchParams({ access_key: key, flight_number: trackingNumber });
      const res2 = await makeGetRequest(`${base}?${qs2.toString()}`);
      if (res2 && Array.isArray(res2.data) && res2.data.length > 0) return normalizeAviationstackResponse(res2);
      return { status: 'not_found', departure: null, arrival: null, raw: res2 || res };
    } catch (err) {
      return { error: 'API_ERROR', message: err.message || String(err) };
    }
  },

  async trackTransport({ type, country, vendorName, trackingNumber }) {
    // Dispatcher: type === 'flight' => aviationstack; otherwise attempt vendor API or return URL.
    if (!type) return { error: 'MISSING_TYPE' };
    if (!trackingNumber) return { error: 'MISSING_TRACKING_NUMBER' };

    const t = String(type).toLowerCase();
    if (t === 'flight') {
      return module.exports.trackFlightRealtime(country, vendorName, trackingNumber);
    }

    // For train/bus, try vendor-provided api_url if available
    const vendor = findVendor(country, type, vendorName);
    if (vendor && vendor.api_url) {
      // Attempt a GET with common query keys. This is best-effort — many APIs require auth or different params.
      const tryKeys = ['tracking_number', 'trainNo', 'train_no', 'train_number', 'number', 'id'];
      for (const key of tryKeys) {
        try {
          const u = new URL(vendor.api_url);
          u.searchParams.set(key, trackingNumber);
          const res = await makeGetRequest(u.toString());
          // If we get a useful-looking response, return it.
          if (res && (res.data || res.result || res.status || Object.keys(res).length > 0)) return res;
        } catch (e) {
          // ignore and try next
        }
      }
      return { error: 'API_UNREACHABLE_OR_UNSUPPORTED', message: 'Vendor API present but request did not return usable data; may require auth or different params', api_url: vendor.api_url };
    }

    // Fallback: return the built tracking URL so UI can redirect the user.
    const built = buildTrackingUrl({ country, type, vendorName, trackingNumber });
    return { tracking_url: built };
  },

  _raw: vendors,

  // Transport mode constants and schemas
  TRANSPORT_MODES,
  TRANSPORT_CATEGORIES,
  TRANSPORT_EXTENSION_SCHEMAS,
  BASE_TRANSPORT_EXTENSION_SCHEMA,

  // Schema utility functions
  getTransportExtensionSchema,
  getFullTransportSchema,
  validateTransportExtension,
  createTransportExtension,
  getTransportCategory,
  getModesInCategory,

  // Individual extension schemas for direct access
  FLIGHT_EXTENSION_SCHEMA,
  TRAIN_EXTENSION_SCHEMA,
  CRUISE_FERRY_EXTENSION_SCHEMA,
  BUS_COACH_EXTENSION_SCHEMA,
  CAR_SHARE_RIDE_EXTENSION_SCHEMA,
  METRO_LOCAL_TRANSIT_EXTENSION_SCHEMA,
  BIKE_SCOOTER_EXTENSION_SCHEMA
};

// --- helper: simple GET using built-in https/http ---
const http = require('http');
const https = require('https');

function makeGetRequest(urlStr, timeout = 10000) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(urlStr);
      const lib = urlObj.protocol === 'https:' ? https : http;
      const req = lib.get(urlObj, { timeout }, res => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (err) {
            // Not JSON — return raw body
            resolve({ body: data, statusCode: res.statusCode });
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });
    } catch (err) {
      reject(err);
    }
  });
}
