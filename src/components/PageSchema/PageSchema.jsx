import React from 'react';
import PropTypes from 'prop-types';

export default function PageSchema({ schema }) {
  if (!schema) return null;
  try {
    const json = JSON.stringify(schema);
    return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
  } catch (err) {
    // Fail silently to avoid breaking the page
    return null;
  }
}

PageSchema.propTypes = {
  schema: PropTypes.object,
};
