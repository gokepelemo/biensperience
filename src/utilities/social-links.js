/**
 * Social media link configurations for curator profiles
 * Each network has an icon component, URL pattern, and display settings
 */

import {
  FaTwitter,
  FaInstagram,
  FaFacebook,
  FaYoutube,
  FaTiktok,
  FaLinkedin,
  FaPinterest,
  FaGithub,
  FaGlobe,
  FaLink
} from 'react-icons/fa';

/**
 * Social media network configurations
 * - id: Unique identifier stored in link.type
 * - name: Display name
 * - icon: React icon component
 * - placeholder: Input placeholder text
 * - urlPattern: Function to generate full URL from username
 * - extractUsername: Function to extract username from full URL
 * - color: Brand color for the network
 */
export const SOCIAL_NETWORKS = {
  twitter: {
    id: 'twitter',
    name: 'X (Twitter)',
    icon: FaTwitter,
    placeholder: 'username (without @)',
    urlPattern: (username) => `https://x.com/${username}`,
    extractUsername: (url) => {
      const match = url.match(/(?:twitter\.com|x\.com)\/([^/?]+)/i);
      return match ? match[1] : null;
    },
    color: '#000000'
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    icon: FaInstagram,
    placeholder: 'username (without @)',
    urlPattern: (username) => `https://instagram.com/${username}`,
    extractUsername: (url) => {
      const match = url.match(/instagram\.com\/([^/?]+)/i);
      return match ? match[1] : null;
    },
    color: '#E4405F'
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    icon: FaFacebook,
    placeholder: 'username or page name',
    urlPattern: (username) => `https://facebook.com/${username}`,
    extractUsername: (url) => {
      const match = url.match(/facebook\.com\/([^/?]+)/i);
      return match ? match[1] : null;
    },
    color: '#1877F2'
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    icon: FaYoutube,
    placeholder: 'channel name or @handle',
    urlPattern: (username) => username.startsWith('@')
      ? `https://youtube.com/${username}`
      : `https://youtube.com/@${username}`,
    extractUsername: (url) => {
      const match = url.match(/youtube\.com\/@?([^/?]+)/i);
      return match ? match[1] : null;
    },
    color: '#FF0000'
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    icon: FaTiktok,
    placeholder: 'username (without @)',
    urlPattern: (username) => `https://tiktok.com/@${username}`,
    extractUsername: (url) => {
      const match = url.match(/tiktok\.com\/@?([^/?]+)/i);
      return match ? match[1] : null;
    },
    color: '#000000'
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: FaLinkedin,
    placeholder: 'profile username',
    urlPattern: (username) => `https://linkedin.com/in/${username}`,
    extractUsername: (url) => {
      const match = url.match(/linkedin\.com\/in\/([^/?]+)/i);
      return match ? match[1] : null;
    },
    color: '#0A66C2'
  },
  pinterest: {
    id: 'pinterest',
    name: 'Pinterest',
    icon: FaPinterest,
    placeholder: 'username',
    urlPattern: (username) => `https://pinterest.com/${username}`,
    extractUsername: (url) => {
      const match = url.match(/pinterest\.com\/([^/?]+)/i);
      return match ? match[1] : null;
    },
    color: '#BD081C'
  },
  github: {
    id: 'github',
    name: 'GitHub',
    icon: FaGithub,
    placeholder: 'username',
    urlPattern: (username) => `https://github.com/${username}`,
    extractUsername: (url) => {
      const match = url.match(/github\.com\/([^/?]+)/i);
      return match ? match[1] : null;
    },
    color: '#181717'
  },
  website: {
    id: 'website',
    name: 'Website',
    icon: FaGlobe,
    placeholder: 'https://yourwebsite.com',
    urlPattern: (url) => url, // Website uses full URL
    extractUsername: () => null, // N/A for websites
    color: '#4A5568',
    isCustomUrl: true
  },
  custom: {
    id: 'custom',
    name: 'Custom Link',
    icon: FaLink,
    placeholder: 'https://example.com',
    urlPattern: (url) => url, // Custom uses full URL
    extractUsername: () => null, // N/A for custom
    color: '#718096',
    isCustomUrl: true
  }
};

/**
 * Get array of social networks for dropdown
 * @returns {Array} Array of network configs
 */
export function getSocialNetworkOptions() {
  return Object.values(SOCIAL_NETWORKS);
}

/**
 * Get social network config by ID
 * @param {string} id - Network ID
 * @returns {Object|null} Network config or null
 */
export function getSocialNetwork(id) {
  return SOCIAL_NETWORKS[id] || null;
}

/**
 * Build full URL from link object
 * @param {Object} link - Link object with type and username/url
 * @returns {string} Full URL
 */
export function buildLinkUrl(link) {
  if (!link) return '';

  const network = getSocialNetwork(link.type);

  // If no network type or custom/website, use the URL directly
  if (!network || network.isCustomUrl) {
    return link.url || '';
  }

  // For social networks, build URL from username
  const username = link.username || link.url;
  if (!username) return '';

  return network.urlPattern(username);
}

/**
 * Get the icon component for a link
 * @param {Object} link - Link object
 * @returns {React.Component} Icon component
 */
export function getLinkIcon(link) {
  if (!link) return FaGlobe;

  const network = getSocialNetwork(link.type);
  return network?.icon || FaGlobe;
}

/**
 * Get display text for a link (username for social, title for custom)
 * @param {Object} link - Link object
 * @returns {string} Display text
 */
export function getLinkDisplayText(link) {
  if (!link) return '';

  const network = getSocialNetwork(link.type);

  // For social networks, show username with @ prefix if applicable
  if (network && !network.isCustomUrl) {
    const username = link.username || '';
    // Add @ for platforms that use it
    if (['twitter', 'instagram', 'tiktok'].includes(link.type) && username && !username.startsWith('@')) {
      return `@${username}`;
    }
    return username;
  }

  // For custom/website, show title
  return link.title || link.url || '';
}

/**
 * Detect social network from URL
 * @param {string} url - URL to analyze
 * @returns {Object|null} Detected network config or null
 */
export function detectNetworkFromUrl(url) {
  if (!url) return null;

  for (const network of Object.values(SOCIAL_NETWORKS)) {
    if (network.isCustomUrl) continue;

    const username = network.extractUsername(url);
    if (username) {
      return { network, username };
    }
  }

  return null;
}
