/**
 * Custom hook for managing SEO meta tags and structured data
 * Provides utilities for setting page-specific SEO data
 *
 * @module useSEO
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getEntityImage } from './seo-meta';

/**
 * Hook for managing page SEO data
 * @param {Object} options - SEO options
 * @param {string} options.title - Page title
 * @param {string} options.description - Page description
 * @param {string} options.image - Image URL
 * @param {Object} options.entity - Entity data for schema.org
 * @param {string} options.entityType - Type of entity
 * @param {boolean} options.noIndex - Whether to add noindex meta tag
 */
export function useSEO({
  title,
  description,
  image,
  entity,
  entityType,
  noIndex = false
}) {
  const location = useLocation();

  useEffect(() => {
    // Set document title
    if (title) {
      document.title = title;
    }

    // Set meta description
    if (description) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', description);
      } else {
        const newMeta = document.createElement('meta');
        newMeta.name = 'description';
        newMeta.content = description;
        document.head.appendChild(newMeta);
      }
    }

    // Set Open Graph tags
    setMetaProperty('og:title', title);
    setMetaProperty('og:description', description);
    setMetaProperty('og:url', window.location.href);
    setMetaProperty('og:image', image);
    setMetaProperty('og:type', entityType === 'experience' ? 'article' : 'website');

    // Set Twitter Card tags
    setMetaName('twitter:card', 'summary_large_image');
    setMetaName('twitter:title', title);
    setMetaName('twitter:description', description);
    setMetaName('twitter:image', image);

    // Set canonical URL
    setCanonicalUrl(window.location.href);

    // Add noindex if specified
    if (noIndex) {
      setMetaName('robots', 'noindex,nofollow');
    }

    // Add schema.org structured data
    if (entity && entityType) {
      addStructuredData(entity, entityType);
    }

    // Cleanup function
    return () => {
      // Remove dynamic meta tags on unmount
      removeMetaProperty('og:title');
      removeMetaProperty('og:description');
      removeMetaProperty('og:url');
      removeMetaProperty('og:image');
      removeMetaProperty('og:type');
      removeMetaName('twitter:card');
      removeMetaName('twitter:title');
      removeMetaName('twitter:description');
      removeMetaName('twitter:image');
      removeStructuredData();
    };
  }, [title, description, image, entity, entityType, noIndex, location.pathname]);
}

/**
 * Set Open Graph meta property
 * @param {string} property - Property name
 * @param {string} content - Content value
 */
function setMetaProperty(property, content) {
  if (!content) return;

  let meta = document.querySelector(`meta[property="${property}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', property);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

/**
 * Set meta name tag
 * @param {string} name - Meta name
 * @param {string} content - Content value
 */
function setMetaName(name, content) {
  if (!content) return;

  let meta = document.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', name);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

/**
 * Remove meta property tag
 * @param {string} property - Property name
 */
function removeMetaProperty(property) {
  const meta = document.querySelector(`meta[property="${property}"]`);
  if (meta) {
    meta.remove();
  }
}

/**
 * Remove meta name tag
 * @param {string} name - Meta name
 */
function removeMetaName(name) {
  const meta = document.querySelector(`meta[name="${name}"]`);
  if (meta) {
    meta.remove();
  }
}

/**
 * Set canonical URL
 * @param {string} url - Canonical URL
 */
function setCanonicalUrl(url) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

/**
 * Add schema.org structured data
 * @param {Object} entity - Entity data
 * @param {string} entityType - Entity type
 */
function addStructuredData(entity, entityType) {
  // Remove existing structured data
  removeStructuredData();

  const schemaData = generateSchemaData(entity, entityType);

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schemaData);
  script.setAttribute('data-seo-schema', 'true');
  document.head.appendChild(script);
}

/**
 * Remove schema.org structured data
 */
function removeStructuredData() {
  const scripts = document.querySelectorAll('script[data-seo-schema]');
  scripts.forEach(script => script.remove());
}

/**
 * Generate schema.org structured data
 * @param {Object} entity - Entity data
 * @param {string} entityType - Entity type
 * @returns {Object} Schema data
 */
function generateSchemaData(entity, entityType) {
  const baseSchema = {
    '@context': 'https://schema.org',
    '@type': getSchemaType(entityType),
    name: entity.name,
    description: entity.description || entity.bio,
    url: window.location.href,
    image: getEntityImage(entity)
  };

  switch (entityType) {
    case 'experience':
      return {
        ...baseSchema,
        '@type': 'TouristTrip',
        touristType: entity.experience_type,
        provider: entity.destination ? {
          '@type': 'Place',
          name: entity.destination.name,
          address: {
            '@type': 'PostalAddress',
            addressCountry: entity.destination.country
          }
        } : undefined,
        offers: entity.cost_estimate ? {
          '@type': 'Offer',
          price: entity.cost_estimate,
          priceCurrency: 'USD'
        } : undefined
      };

    case 'destination':
      return {
        ...baseSchema,
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressCountry: entity.country,
          addressRegion: entity.state
        }
      };

    case 'user':
      return {
        ...baseSchema,
        '@type': 'Person',
        givenName: entity.name?.split(' ')[0],
        familyName: entity.name?.split(' ').slice(1).join(' ')
      };

    default:
      return baseSchema;
  }
}

/**
 * Get schema.org type for entity
 * @param {string} entityType - Entity type
 * @returns {string} Schema type
 */
function getSchemaType(entityType) {
  const typeMap = {
    experience: 'TouristTrip',
    destination: 'Place',
    user: 'Person'
  };
  return typeMap[entityType] || 'Thing';
}