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

  _raw: vendors
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
