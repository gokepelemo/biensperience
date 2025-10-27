import { useSEO } from '../../utilities/useSEO';
import { SEOMeta, getEntityImage } from '../../utilities/seo-meta';

/**
 * PageMeta component for managing document title and meta tags
 * Now uses React Helmet for proper SSR support and cleaner implementation
 *
 * @param {string} title - The page title
 * @param {string} description - The page description (meta description)
 * @param {string} keywords - Comma-separated keywords for SEO
 * @param {string} ogTitle - Open Graph title (for social sharing)
 * @param {string} ogDescription - Open Graph description
 * @param {string} ogImage - Open Graph image URL
 * @param {string} canonical - Canonical URL for the page
 * @param {Object} entity - Entity data for schema.org structured data
 * @param {string} entityType - Type of entity (experience, destination, user)
 * @param {boolean} noIndex - Whether to add noindex meta tag
 */
export default function PageMeta({
  title,
  description,
  keywords,
  ogTitle,
  ogDescription,
  ogImage,
  canonical,
  entity,
  entityType,
  noIndex = false
}) {
  // Auto-resolve image from entity if not manually provided
  const resolvedImage = ogImage || (entity ? getEntityImage(entity) : '/logo.png');

  // Use the SEO hook for dynamic meta tag management
  useSEO({
    title: title || 'Biensperience - Plan Your Next Adventure',
    description: description || 'Discover and plan amazing travel experiences worldwide. Browse curated destinations, create your travel bucket list, and organize your adventures with Biensperience.',
    image: resolvedImage,
    entity,
    entityType,
    noIndex
  });

  // Use the SEOMeta component for static meta tags
  return (
    <SEOMeta
      title={ogTitle || title}
      description={ogDescription || description}
      url={canonical}
      image={resolvedImage}
      type="website"
      siteName="Biensperience"
      twitter={{
        handle: '@biensperience'
      }}
    />
  );
}
