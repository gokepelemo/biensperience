import React from 'react';
import { SchemaScript, generateSchemaData } from './OpenGraphMeta.jsx';

/**
 * EntitySchema - lightweight helper to render schema.org JSON-LD for an entity.
 * Use this inside components that represent entities when you want the component
 * to emit structured data (e.g. for embedding in storybook or standalone embeds).
 *
 * Props:
 * - entity: object - the entity data
 * - entityType: string - 'experience' | 'destination' | 'user'
 */
export default function EntitySchema({ entity, entityType }) {
  if (!entity || !entityType) return null;

  const schemaData = generateSchemaData(entity, entityType);

  return <SchemaScript schemaData={schemaData} />;
}
