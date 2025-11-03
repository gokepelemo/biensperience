/**
 * Image utility functions for dimension detection and manipulation
 */

/**
 * Get image dimensions from a URL
 * @param {string} url - Image URL to load
 * @returns {Promise<{width: number, height: number}>} Image dimensions
 */
export function getImageDimensionsFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Set crossOrigin to handle CORS for external images
    img.crossOrigin = 'anonymous';
    img.src = url;

    // Timeout after 10 seconds
    setTimeout(() => {
      reject(new Error('Image load timeout'));
    }, 10000);
  });
}

/**
 * Get image dimensions from a File object
 * @param {File} file - Image file to read
 * @returns {Promise<{width: number, height: number}>} Image dimensions
 */
export function getImageDimensionsFromFile(file) {
  return new Promise((resolve, reject) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      reject(new Error('File is not an image'));
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };

      img.onerror = () => {
        reject(new Error('Failed to load image from file'));
      };

      img.src = e.target.result;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Calculate aspect ratio from dimensions
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {string} Aspect ratio as CSS value (e.g., "16/9")
 */
export function calculateAspectRatio(width, height) {
  if (!width || !height || width <= 0 || height <= 0) {
    return 'auto';
  }
  return `${width}/${height}`;
}

/**
 * Get image dimensions with error handling
 * Returns undefined dimensions on error instead of throwing
 * @param {string|File} source - Image URL or File object
 * @returns {Promise<{width?: number, height?: number}>} Image dimensions or empty object
 */
export async function getImageDimensionsSafe(source) {
  try {
    if (typeof source === 'string') {
      return await getImageDimensionsFromUrl(source);
    } else if (source instanceof File) {
      return await getImageDimensionsFromFile(source);
    }
    return {};
  } catch (err) {
    console.warn('Failed to get image dimensions:', err.message);
    return {};
  }
}
