export default {
  title: 'Design System/Design Tokens',
};

export const Tokens = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <section>
        <h2>Colors</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
          {[
            ['Primary', 'var(--color-primary)'],
            ['Primary 2', 'var(--color-primary-2, #8a6ccf)'],
            ['BG Primary', 'var(--color-bg-primary, #ffffff)'],
            ['BG Secondary', 'var(--color-bg-secondary, #f8f9fa)'],
            ['Text Primary', 'var(--color-text-primary, #1a202c)'],
            ['Text Muted', 'var(--color-text-muted, #6c757d)'],
            ['Success', 'var(--color-success, #28a745)'],
            ['Danger', 'var(--color-danger, #dc3545)'],
            ['Warning', 'var(--color-warning, #ffc107)'],
            ['Info', 'var(--color-info, #17a2b8)'],
          ].map(([name, value]) => (
            <div key={name} style={{ border: '1px solid #e9ecef', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ height: 56, background: value }} />
              <div style={{ padding: '0.5rem', fontSize: 12 }}>{name}<br/><code>{value}</code></div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Radii</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            ['XS', 'var(--radius-xs, 4px)'],
            ['SM', 'var(--radius-sm, 6px)'],
            ['MD', 'var(--radius-md, 8px)'],
            ['LG', 'var(--radius-lg, 12px)'],
            ['XL', 'var(--radius-xl, 16px)'],
          ].map(([name, value]) => (
            <div key={name} style={{ width: 100, height: 56, background: 'var(--color-bg-secondary, #f8f9fa)', border: '1px solid #e9ecef', borderRadius: `var(--radius-${name.toLowerCase()}, ${value})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
              {name}<br/><code>{value}</code>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Spacing</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[
            ['XS', 'var(--space-xs, 4px)'],
            ['SM', 'var(--space-sm, 8px)'],
            ['MD', 'var(--space-md, 12px)'],
            ['LG', 'var(--space-lg, 16px)'],
            ['XL', 'var(--space-xl, 24px)'],
          ].map(([name, value]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 64, textAlign: 'right', fontSize: 12 }}>{name}</div>
              <div style={{ height: 12, width: `var(--space-${name.toLowerCase()}, ${value})`, background: 'var(--color-primary, #7d88f2)' }} />
              <code style={{ fontSize: 12 }}>{value}</code>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Shadows</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {['xs', 'sm', 'md', 'lg'].map((k) => (
            <div key={k} style={{ width: 140, height: 72, background: '#fff', borderRadius: 8, boxShadow: `var(--shadow-${k})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, border: '1px solid #e9ecef' }}>
              {k.toUpperCase()}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
};
