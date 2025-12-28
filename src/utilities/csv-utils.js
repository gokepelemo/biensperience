/**
 * CSV Utilities
 *
 * Provides functions for generating and downloading CSV files from data arrays.
 * Handles proper escaping of values containing commas, quotes, and newlines.
 *
 * @module csv-utils
 */

import { logger } from './logger';

/**
 * Escapes a CSV cell value properly
 * - Wraps in quotes if contains comma, quote, or newline
 * - Doubles any quotes within the value
 *
 * @param {*} value - The value to escape
 * @returns {string} - Properly escaped CSV cell value
 */
export function escapeCsvCell(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // Check if value needs quoting (contains comma, quote, or newline)
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    // Escape quotes by doubling them and wrap in quotes
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Converts a 2D array of data to CSV string format
 *
 * @param {Array<Array<*>>} rows - Array of rows, each row is an array of cell values
 * @returns {string} - CSV formatted string
 */
export function arrayToCsv(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return '';
  }

  return rows
    .map(row => {
      if (!Array.isArray(row)) {
        return '';
      }
      return row.map(escapeCsvCell).join(',');
    })
    .join('\n');
}

/**
 * Converts an array of objects to CSV string format
 *
 * @param {Array<Object>} data - Array of objects to convert
 * @param {Object} options - Configuration options
 * @param {Array<string>} [options.columns] - Array of column keys to include (defaults to all keys from first object)
 * @param {Object<string, string>} [options.headers] - Map of column keys to header display names
 * @param {Object<string, Function>} [options.formatters] - Map of column keys to formatter functions
 * @returns {string} - CSV formatted string
 */
export function objectsToCsv(data, options = {}) {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }

  const { columns, headers = {}, formatters = {} } = options;

  // Determine columns from first object if not specified
  const cols = columns || Object.keys(data[0]);

  // Create header row
  const headerRow = cols.map(col => headers[col] || col);

  // Create data rows
  const dataRows = data.map(item => {
    return cols.map(col => {
      let value = item[col];

      // Apply formatter if provided
      if (formatters[col] && typeof formatters[col] === 'function') {
        try {
          value = formatters[col](value, item);
        } catch (e) {
          logger.warn('[csv-utils] Formatter error for column', { column: col, error: e.message });
        }
      }

      return value;
    });
  });

  // Combine header and data rows
  return arrayToCsv([headerRow, ...dataRows]);
}

/**
 * Triggers a download of a CSV string as a file
 *
 * @param {string} csvContent - The CSV content to download
 * @param {string} filename - The filename for the download (without extension)
 * @param {Object} options - Additional options
 * @param {boolean} [options.includeBom=false] - Whether to include BOM for Excel compatibility
 */
export function downloadCsv(csvContent, filename, options = {}) {
  const { includeBom = false } = options;

  // Add BOM for Excel compatibility if requested
  const content = includeBom ? '\uFEFF' + csvContent : csvContent;

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  // Ensure filename has .csv extension
  const fullFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;

  link.href = url;
  link.download = fullFilename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);

  logger.debug('[csv-utils] CSV downloaded', { filename: fullFilename });
}

/**
 * Convenience function to export data to CSV and trigger download
 *
 * @param {Array<Object>} data - Array of objects to export
 * @param {string} filename - The filename for the download (without extension)
 * @param {Object} options - Configuration options
 * @param {Array<string>} [options.columns] - Array of column keys to include
 * @param {Object<string, string>} [options.headers] - Map of column keys to header display names
 * @param {Object<string, Function>} [options.formatters] - Map of column keys to formatter functions
 * @param {boolean} [options.includeBom=false] - Whether to include BOM for Excel compatibility
 * @returns {boolean} - True if export was successful, false otherwise
 */
export function exportToCsv(data, filename, options = {}) {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      logger.warn('[csv-utils] No data to export');
      return false;
    }

    const csvContent = objectsToCsv(data, options);

    if (!csvContent) {
      logger.warn('[csv-utils] Generated CSV content is empty');
      return false;
    }

    downloadCsv(csvContent, filename, options);
    return true;
  } catch (error) {
    logger.error('[csv-utils] Export failed', { filename }, error);
    return false;
  }
}

/**
 * Formats a date value for CSV export
 *
 * @param {Date|string|number} value - Date value to format
 * @param {Object} options - Formatting options
 * @param {string} [options.format='iso'] - Format type: 'iso', 'date', 'datetime', 'locale'
 * @param {string} [options.locale] - Locale for locale format
 * @returns {string} - Formatted date string
 */
export function formatDateForCsv(value, options = {}) {
  if (!value) return '';

  const { format = 'iso', locale } = options;
  const date = value instanceof Date ? value : new Date(value);

  if (isNaN(date.getTime())) {
    return String(value);
  }

  switch (format) {
    case 'date':
      return date.toISOString().split('T')[0];
    case 'datetime':
      return date.toISOString().replace('T', ' ').split('.')[0];
    case 'locale':
      return date.toLocaleString(locale);
    case 'iso':
    default:
      return date.toISOString();
  }
}
