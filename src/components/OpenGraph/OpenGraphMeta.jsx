/**
 * OpenGraph and Social Media Meta Tags Utility
 * Generates Open Graph, Twitter Cards, and schema.org structured data
 * for better search engine optimization and social media sharing
 *
 * @module OpenGraphMeta
 */

import React from 'react';
import { Helmet } from 'react-helmet-async';

/**
 * Generate Open Graph and Twitter Card meta tags
 * @param {Object} options - OpenGraph options
 * @param {string} options.title - Page title
 * @param {string} options.description - Page description
 * @param {string} options.url - Canonical URL
 * @param {string} options.image - Image URL for social sharing
 * @param {string} options.type - Open Graph type (website, article, etc.)
 * @param {string} options.siteName - Site name
 * @param {Object} options.twitter - Twitter-specific options
 * @returns {ReactElement} Helmet component with meta tags
 */
export function OpenGraphMeta({
  title,
  description,
  url,
  image,
  type = 'website',
  siteName = 'Biensperience',
  twitter = {}
}) {
  const metaTags = [];

  // Basic meta tags
  if (title) {
    metaTags.push(<title key="title">{title}</title>);
    metaTags.push(<meta key="og:title" property="og:title" content={title} />);
    metaTags.push(<meta key="twitter:title" name="twitter:title" content={title} />);
  }

  if (description) {
    metaTags.push(<meta key="description" name="description" content={description} />);
    metaTags.push(<meta key="og:description" property="og:description" content={description} />);
    metaTags.push(<meta key="twitter:description" name="twitter:description" content={description} />);
  }

  if (url) {
    metaTags.push(<link key="canonical" rel="canonical" href={url} />);
    metaTags.push(<meta key="og:url" property="og:url" content={url} />);
  }

  if (image) {
    metaTags.push(<meta key="og:image" property="og:image" content={image} />);
    metaTags.push(<meta key="twitter:image" name="twitter:image" content={image} />);
    metaTags.push(<meta key="twitter:card" name="twitter:card" content="summary_large_image" />);
  }

  // Open Graph basics
  metaTags.push(<meta key="og:type" property="og:type" content={type} />);
  if (siteName) {
    metaTags.push(<meta key="og:site_name" property="og:site_name" content={siteName} />);
  }

  // Twitter specific
  if (twitter.handle) {
    metaTags.push(<meta key="twitter:site" name="twitter:site" content={twitter.handle} />);
  }
  if (twitter.creator) {
    metaTags.push(<meta key="twitter:creator" name="twitter:creator" content={twitter.creator} />);
  }

  return <Helmet>{metaTags}</Helmet>;
}

/**
 * Generate schema.org structured data for entities
 * @param {Object} entity - Entity data
 * @param {string} entityType - Type of entity (experience, destination, user)
 * @returns {Object} Schema.org structured data
 */
export function generateSchemaData(entity, entityType) {
  const baseSchema = {
    '@context': 'https://schema.org',
    '@type': getSchemaType(entityType),
    name: entity.name,
    description: entity.description || entity.bio,
    url: getEntityUrl(entity, entityType),
    image: getEntityImage(entity)
  };

  // Add entity-specific properties
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
            addressCountry: entity.destination.country,
            addressRegion: entity.destination.state
          }
        } : undefined,
        offers: entity.cost_estimate ? {
          '@type': 'Offer',
          price: entity.cost_estimate,
          priceCurrency: 'USD',
          description: `Estimated cost for ${entity.name}`
        } : undefined,
        duration: entity.max_planning_days ? `P${entity.max_planning_days}D` : undefined,
        additionalProperty: [
          entity.experience_type ? {
            '@type': 'PropertyValue',
            name: 'Experience Type',
            value: entity.experience_type
          } : undefined,
          entity.max_planning_days ? {
            '@type': 'PropertyValue',
            name: 'Planning Days',
            value: entity.max_planning_days
          } : undefined
        ].filter(Boolean),
        aggregateRating: entity.average_rating ? {
          '@type': 'AggregateRating',
          ratingValue: entity.average_rating,
          bestRating: 5,
          worstRating: 1
        } : undefined
      };

    case 'destination':
      return {
        ...baseSchema,
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressCountry: entity.country,
          addressRegion: entity.state,
          addressLocality: entity.name
        },
        geo: entity.location?.geo?.coordinates?.length === 2 ? {
          '@type': 'GeoCoordinates',
          latitude: entity.location.geo.coordinates[1],
          longitude: entity.location.geo.coordinates[0]
        } : entity.map_location ? {
          '@type': 'GeoCoordinates',
          latitude: entity.map_location.lat,
          longitude: entity.map_location.lng
        } : undefined,
        containsPlace: entity.experiences?.length > 0 ? entity.experiences.map(exp => ({
          '@type': 'TouristTrip',
          name: exp.name,
          url: `${baseSchema.url}/experiences/${exp._id}`
        })) : undefined,
        additionalProperty: [
          entity.travel_tips?.length > 0 ? {
            '@type': 'PropertyValue',
            name: 'Travel Tips',
            value: entity.travel_tips.length
          } : undefined
        ].filter(Boolean)
      };

    case 'user':
      return {
        ...baseSchema,
        '@type': 'Person',
        givenName: entity.name?.split(' ')[0],
        familyName: entity.name?.split(' ').slice(1).join(' '),
        knowsAbout: [
          ...(entity.experiences?.map(exp => exp.name) || []),
          ...(entity.destinations?.map(dest => dest.name) || [])
        ],
        hasOccupation: {
          '@type': 'Occupation',
          name: 'Travel Enthusiast'
        },
        additionalProperty: [
          entity.experiences?.length > 0 ? {
            '@type': 'PropertyValue',
            name: 'Planned Experiences',
            value: entity.experiences.length
          } : undefined,
          entity.destinations?.length > 0 ? {
            '@type': 'PropertyValue',
            name: 'Favorite Destinations',
            value: entity.destinations.length
          } : undefined
        ].filter(Boolean)
      };

    default:
      return baseSchema;
  }
}

/**
 * Get schema.org type for entity
 * @param {string} entityType - Entity type
 * @returns {string} Schema.org type
 */
function getSchemaType(entityType) {
  const typeMap = {
    experience: 'TouristTrip',
    destination: 'Place',
    user: 'Person'
  };
  return typeMap[entityType] || 'Thing';
}

/**
 * Get entity URL
 * @param {Object} entity - Entity object
 * @param {string} entityType - Entity type
 * @returns {string} Full URL
 */
function getEntityUrl(entity, entityType) {
  const baseUrl = process.env.REACT_APP_BASE_URL || window.location.origin;
  const pathMap = {
    experience: `/experiences/${entity._id}`,
    destination: `/destinations/${entity._id}`,
    user: `/users/${entity._id}`
  };
  return `${baseUrl}${pathMap[entityType] || ''}`;
}

/**
 * Get entity image URL using default photo index or fallback to site default
 * @param {Object} entity - Entity object
 * @param {string} fallbackImage - Fallback image URL (default: '/logo.png')
 * @returns {string} Image URL
 */
export function getEntityImage(entity, fallbackImage = '/logo.png') {
  if (!entity) return fallbackImage;

  // For entities with photos array (experiences, destinations)
  if (entity.photos && entity.photos.length > 0) {
    const defaultIndex = entity.default_photo_index || 0;
    const photo = entity.photos[defaultIndex];
    if (photo && photo.url) {
      return photo.url;
    }
  }

  // For entities with single photo field (users, destinations)
  if (entity.photo && entity.photo.url) {
    return entity.photo.url;
  }

  // Fallback to site default
  return fallbackImage;
}

/**
 * Render schema.org JSON-LD script tag
 * @param {Object} schemaData - Schema.org structured data
 * @returns {ReactElement} Script tag
 */
export function SchemaScript({ schemaData }) {
  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schemaData)}
      </script>
    </Helmet>
  );
}

/**
 * Combined OpenGraph component with both meta tags and schema data
 * @param {Object} options - OpenGraph options
 * @param {Object} entity - Entity data for schema
 * @param {string} entityType - Entity type
 * @returns {ReactElement} Combined OpenGraph component
 */
export function OpenGraphHead({ entity, entityType, ...openGraphOptions }) {
  const schemaData = entity ? generateSchemaData(entity, entityType) : null;

  return (
    <>
      <OpenGraphMeta {...openGraphOptions} />
      {schemaData && <SchemaScript schemaData={schemaData} />}
    </>
  );
}