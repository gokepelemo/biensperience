/**
 * Form Validation Utilities
 * Provides comprehensive client-side validation with friendly error messages
 */

/**
 * Validates an email address
 * @param {string} email - Email to validate
 * @returns {Object} - {isValid: boolean, message: string}
 */
export function validateEmail(email) {
  if (!email || email.trim() === '') {
    return { isValid: false, message: 'Email is required' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, message: 'Please enter a valid email address' };
  }
  
  if (email.length > 254) {
    return { isValid: false, message: 'Email is too long' };
  }
  
  return { isValid: true, message: 'Looks good!' };
}

/**
 * Validates a password
 * @param {string} password - Password to validate
 * @param {number} minLength - Minimum password length (default: 3)
 * @returns {Object} - {isValid: boolean, message: string}
 */
export function validatePassword(password, minLength = 3) {
  if (!password || password.trim() === '') {
    return { isValid: false, message: 'Password is required' };
  }
  
  if (password.length < minLength) {
    return { isValid: false, message: `Password must be at least ${minLength} characters` };
  }
  
  if (password.length > 128) {
    return { isValid: false, message: 'Password is too long' };
  }
  
  return { isValid: true, message: 'Password strength looks good!' };
}

/**
 * Validates password confirmation
 * @param {string} password - Original password
 * @param {string} confirmPassword - Confirmation password
 * @returns {Object} - {isValid: boolean, message: string}
 */
export function validatePasswordMatch(password, confirmPassword) {
  if (!confirmPassword || confirmPassword.trim() === '') {
    return { isValid: false, message: 'Please confirm your password' };
  }
  
  if (password !== confirmPassword) {
    return { isValid: false, message: 'Passwords do not match' };
  }
  
  return { isValid: true, message: 'Passwords match!' };
}

/**
 * Validates a required text field
 * @param {string} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @param {number} minLength - Minimum length (default: 1)
 * @param {number} maxLength - Maximum length (default: 500)
 * @returns {Object} - {isValid: boolean, message: string}
 */
export function validateRequired(value, fieldName = 'This field', minLength = 1, maxLength = 500) {
  if (!value || value.trim() === '') {
    return { isValid: false, message: `${fieldName} is required` };
  }
  
  if (value.trim().length < minLength) {
    return { isValid: false, message: `${fieldName} must be at least ${minLength} characters` };
  }
  
  if (value.length > maxLength) {
    return { isValid: false, message: `${fieldName} must be less than ${maxLength} characters` };
  }
  
  return { isValid: true, message: 'Perfect!' };
}

/**
 * Validates a URL
 * @param {string} url - URL to validate
 * @param {boolean} required - Whether the URL is required
 * @returns {Object} - {isValid: boolean, message: string}
 */
export function validateUrl(url, required = false) {
  if (!url || url.trim() === '') {
    if (required) {
      return { isValid: false, message: 'URL is required' };
    }
    return { isValid: true, message: '' };
  }
  
  try {
    new URL(url);
    return { isValid: true, message: 'Valid URL!' };
  } catch {
    return { isValid: false, message: 'Please enter a valid URL (e.g., https://example.com)' };
  }
}

/**
 * Validates a number field
 * @param {string|number} value - Value to validate
 * @param {Object} options - Validation options {min, max, required, fieldName}
 * @returns {Object} - {isValid: boolean, message: string}
 */
export function validateNumber(value, options = {}) {
  const { min, max, required = false, fieldName = 'This field' } = options;
  
  if (!value && value !== 0) {
    if (required) {
      return { isValid: false, message: `${fieldName} is required` };
    }
    return { isValid: true, message: '' };
  }
  
  const num = Number(value);
  
  if (isNaN(num)) {
    return { isValid: false, message: `${fieldName} must be a number` };
  }
  
  if (min !== undefined && num < min) {
    return { isValid: false, message: `${fieldName} must be at least ${min}` };
  }
  
  if (max !== undefined && num > max) {
    return { isValid: false, message: `${fieldName} must be at most ${max}` };
  }
  
  return { isValid: true, message: 'Great!' };
}

/**
 * Validates a date
 * @param {string} date - Date string to validate
 * @param {Object} options - Validation options {required, minDate, maxDate, fieldName}
 * @returns {Object} - {isValid: boolean, message: string}
 */
export function validateDate(date, options = {}) {
  const { required = false, minDate, maxDate, fieldName = 'Date' } = options;
  
  if (!date || date.trim() === '') {
    if (required) {
      return { isValid: false, message: `${fieldName} is required` };
    }
    return { isValid: true, message: '' };
  }
  
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return { isValid: false, message: 'Please enter a valid date' };
  }
  
  if (minDate && dateObj < new Date(minDate)) {
    return { isValid: false, message: `Date must be after ${new Date(minDate).toLocaleDateString()}` };
  }
  
  if (maxDate && dateObj > new Date(maxDate)) {
    return { isValid: false, message: `Date must be before ${new Date(maxDate).toLocaleDateString()}` };
  }
  
  return { isValid: true, message: 'Date looks good!' };
}

/**
 * Validates a file upload
 * @param {File} file - File to validate
 * @param {Object} options - Validation options {required, maxSize, allowedTypes}
 * @returns {Object} - {isValid: boolean, message: string}
 */
export function validateFile(file, options = {}) {
  const { required = false, maxSize = 5 * 1024 * 1024, allowedTypes = [] } = options; // 5MB default
  
  if (!file) {
    if (required) {
      return { isValid: false, message: 'Please select a file' };
    }
    return { isValid: true, message: '' };
  }
  
  if (maxSize && file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    return { isValid: false, message: `File size must be less than ${maxSizeMB}MB` };
  }
  
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return { isValid: false, message: `File type must be one of: ${allowedTypes.join(', ')}` };
  }
  
  return { isValid: true, message: 'File looks good!' };
}

/**
 * Adds visual validation state to a form element
 * @param {HTMLElement} element - Form element to update
 * @param {boolean} isValid - Whether the validation passed
 * @param {string} message - Validation message
 */
export function updateFieldValidation(element, isValid, message) {
  if (!element) return;
  
  // Remove existing validation classes
  element.classList.remove('is-valid', 'is-invalid');
  
  // Add appropriate class
  if (isValid) {
    element.classList.add('is-valid');
  } else if (message) {
    element.classList.add('is-invalid');
  }
  
  // Update feedback message
  const feedbackElement = element.parentElement?.querySelector('.invalid-feedback, .valid-feedback');
  if (feedbackElement) {
    feedbackElement.textContent = message;
    feedbackElement.className = isValid ? 'valid-feedback d-block' : 'invalid-feedback d-block';
  }
}

/**
 * Validates an entire form
 * @param {Object} formData - Object containing form field values
 * @param {Object} validationRules - Object containing validation functions for each field
 * @returns {Object} - {isValid: boolean, errors: Object}
 */
export function validateForm(formData, validationRules) {
  const errors = {};
  let isValid = true;
  
  Object.keys(validationRules).forEach(fieldName => {
    const validation = validationRules[fieldName](formData[fieldName], formData);
    if (!validation.isValid) {
      errors[fieldName] = validation.message;
      isValid = false;
    }
  });
  
  return { isValid, errors };
}

/**
 * Debounce function for validation
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
