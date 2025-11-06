import React from 'react';

export default function DesignNotes({ title = 'Design Notes', items = [] }) {
  return (
    <div style={{
      margin: 'var(--space-6) auto 0',
      maxWidth: 640,
      background: 'var(--color-bg-primary)',
      border: '1px solid var(--color-border-light)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-5) var(--space-6)',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <h6 style={{
        margin: 0,
        marginBottom: 'var(--space-3)',
        color: 'var(--color-text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: 'var(--letter-spacing-wide)',
        fontSize: 'var(--font-size-xs)'
      }}>{title}</h6>
      <ul style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 'var(--space-2)'
      }}>
        {items.map((it, idx) => (
          <li key={idx} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
            <strong style={{ color: 'var(--color-text-secondary)' }}>{it.label}:</strong> {it.value}
          </li>
        ))}
      </ul>
    </div>
  );
}
