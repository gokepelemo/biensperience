import { getDefaultPhoto } from './photo-utils';

export function buildDestinationSchema(destination, siteBaseUrl = '') {
  if (!destination) return null;

  const image = (getDefaultPhoto && getDefaultPhoto(destination)?.url) || (destination.photos && destination.photos[0]?.url);
  const url = destination.slug
    ? `${siteBaseUrl}/destinations/${destination.slug}`
    : siteBaseUrl && destination._id
    ? `${siteBaseUrl}/destinations/${destination._id}`
    : undefined;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: destination.name,
    description: destination.overview || undefined,
    image: image || undefined,
    url: url || undefined,
  };

  try {
    // Try new location.geo structure first
    if (destination.location?.geo?.coordinates?.length === 2) {
      const [lng, lat] = destination.location.geo.coordinates;
      schema.geo = {
        "@type": "GeoCoordinates",
        latitude: lat,
        longitude: lng,
      };
    } else {
      // Fallback to legacy map_location
      const loc = destination.map_location;
      if (loc && typeof loc === 'object' && (loc.lat || loc.latitude) && (loc.lng || loc.longitude)) {
        schema.geo = {
          "@type": "GeoCoordinates",
          latitude: Number(loc.lat || loc.latitude),
          longitude: Number(loc.lng || loc.longitude),
        };
      } else if (typeof loc === 'string' && loc.includes(',')) {
        const [latStr, lngStr] = loc.split(',').map(s => s.trim());
        const lat = Number(latStr);
        const lng = Number(lngStr);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          schema.geo = {
            "@type": "GeoCoordinates",
            latitude: lat,
            longitude: lng,
          };
        }
      }
    }
  } catch (err) {
    // ignore geo on parse errors
  }

  if (destination.city || destination.state || destination.country) {
    schema.address = {
      "@type": "PostalAddress",
      addressLocality: destination.city || undefined,
      addressRegion: destination.state || undefined,
      addressCountry: destination.country || undefined,
    };
  }

  if (destination.user && (destination.user.name || destination.user._id)) {
    schema.provider = {
      "@type": "Person",
      name: destination.user.name || undefined,
      url: siteBaseUrl && destination.user._id ? `${siteBaseUrl}/users/${destination.user._id}` : undefined,
    };
  }

  return schema;
}

export function buildExperienceSchema(experience, siteBaseUrl = '') {
  if (!experience) return null;

  const image = (getDefaultPhoto && getDefaultPhoto(experience)?.url) || (experience.photos && experience.photos[0]?.url);
  const url = experience.slug
    ? `${siteBaseUrl}/experiences/${experience.slug}`
    : siteBaseUrl && experience._id
    ? `${siteBaseUrl}/experiences/${experience._id}`
    : undefined;

  const schema = {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: experience.name,
    description: experience.overview || experience.description || undefined,
    image: image || undefined,
    url: url || undefined,
  };

  if (experience.destination && (experience.destination._id || experience.destination.slug || experience.destination.name)) {
    const dest = experience.destination;
    schema.location = {
      "@type": "Place",
      name: dest.name || undefined,
      url: dest.slug ? `${siteBaseUrl}/destinations/${dest.slug}` : siteBaseUrl && dest._id ? `${siteBaseUrl}/destinations/${dest._id}` : undefined,
    };
  }

  try {
    const costs = experience.costs || (experience.plan_snapshot && experience.plan_snapshot.costs) || [];
    const numericCosts = (Array.isArray(costs) ? costs : []).filter(c => c && typeof c.cost === 'number');

    if (numericCosts.length === 1) {
      const c = numericCosts[0];
      schema.offers = {
        "@type": "Offer",
        price: Number(c.cost),
        priceCurrency: c.currency || 'USD',
        name: c.title || undefined,
      };
    } else if (numericCosts.length > 1) {
      schema.offers = {
        "@type": "AggregateOffer",
        lowPrice: Math.min(...numericCosts.map(c => c.cost)),
        highPrice: Math.max(...numericCosts.map(c => c.cost)),
        priceCurrency: numericCosts[0].currency || 'USD',
      };
    }
  } catch (err) {
    // ignore offers on error
  }

  if (experience.user && (experience.user.name || experience.user._id)) {
    schema.organizer = {
      "@type": "Person",
      name: experience.user.name || undefined,
      url: siteBaseUrl && experience.user._id ? `${siteBaseUrl}/users/${experience.user._id}` : undefined,
    };
  }

  return schema;
}
