import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { lang } from '../../lang.constants';

/**
 * PageMeta component for managing document title and meta tags
 *
 * @param {string} title - The page title
 * @param {string} description - The page description (meta description)
 * @param {string} keywords - Comma-separated keywords for SEO
 * @param {string} ogTitle - Open Graph title (for social sharing)
 * @param {string} ogDescription - Open Graph description
 * @param {string} ogImage - Open Graph image URL
 * @param {string} canonical - Canonical URL for the page
 */
export default function PageMeta({
  title = lang.en.pageMeta.defaultTitle,
  description = lang.en.pageMeta.defaultDescription,
  keywords = lang.en.pageMeta.defaultKeywords,
  ogTitle,
  ogDescription,
  ogImage = lang.en.pageMeta.defaultOgImage,
  canonical
}) {
  const location = useLocation();

  useEffect(() => {
    // Set document title
    document.title = title.includes('Biensperience') ? title : `${title} - Biensperience`;

    // Set or update meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.name = 'description';
      document.head.appendChild(metaDescription);
    }
    metaDescription.content = description;

    // Set or update meta keywords
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.name = 'keywords';
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.content = keywords;

    // Open Graph meta tags
    const ogTags = [
      { property: 'og:title', content: ogTitle || title },
      { property: 'og:description', content: ogDescription || description },
      { property: 'og:image', content: ogImage },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: canonical || window.location.href }
    ];

    ogTags.forEach(({ property, content }) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
      }
      tag.content = content;
    });

    // Twitter Card meta tags
    const twitterTags = [
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: ogTitle || title },
      { name: 'twitter:description', content: ogDescription || description },
      { name: 'twitter:image', content: ogImage }
    ];

    twitterTags.forEach(({ name, content }) => {
      let tag = document.querySelector(`meta[name="${name}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.name = name;
        document.head.appendChild(tag);
      }
      tag.content = content;
    });

    // Canonical link
    const canonicalUrl = canonical || window.location.href;
    let linkCanonical = document.querySelector('link[rel="canonical"]');
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.rel = 'canonical';
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.href = canonicalUrl;

  }, [title, description, keywords, ogTitle, ogDescription, ogImage, canonical, location]);

  // This component doesn't render anything
  return null;
}
