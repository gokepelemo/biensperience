import { Title, Subtitle, Description, Primary, Stories } from '@storybook/blocks';

export default {
	title: 'Design System/Design Tokens',
	parameters: {
		docs: {
			page: () => (
				<div>
					<Title />
					<Subtitle>Foundations</Subtitle>
					<Description>
						Visualize key tokens used across the app. These tokens drive light/dark theming and consistent spacing and shadows.
					</Description>
					<Primary />
					<Stories title="Token Examples" />
				</div>
			)
		}
	}
};

const Box = ({ style, children }) => (
	<div style={style}>{children}</div>
);

export const Tokens = {
	render: () => (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
			<section>
				<h2>Colors</h2>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
					{[
						['Primary', 'var(--color-primary)'],
						['BG Primary', 'var(--color-bg-primary)'],
						['BG Secondary', 'var(--color-bg-secondary)'],
						['Text Primary', 'var(--color-text-primary)'],
						['Text Muted', 'var(--color-text-muted)'],
						['Success', 'var(--color-success)'],
						['Danger', 'var(--color-danger)'],
						['Warning', 'var(--color-warning)'],
						['Info', 'var(--color-info)'],
					].map(([name, value]) => (
						<Box
							key={name}
							style={{ border: '1px solid var(--color-border-light)', borderRadius: 8, overflow: 'hidden', background: 'var(--color-bg-primary)' }}
						>
							<div style={{ height: 56, background: value }} />
							<div style={{ padding: '0.5rem', fontSize: 12, color: 'var(--color-text-primary)' }}>
								{name}<br/><code>{value}</code>
							</div>
						</Box>
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
						<Box
							key={name}
							style={{ width: 120, height: 64, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-light)', borderRadius: `var(--radius-${name.toLowerCase()}, ${value})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--color-text-primary)' }}
						>
							{name}<br/><code>{value}</code>
						</Box>
					))}
				</div>
			</section>

			<section>
				<h2>Spacing</h2>
				<div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
					{[
						['XS', 'var(--space-1, 4px)'],
						['SM', 'var(--space-2, 8px)'],
						['MD', 'var(--space-3, 12px)'],
						['LG', 'var(--space-4, 16px)'],
						['XL', 'var(--space-6, 24px)'],
					].map(([name, value]) => (
						<div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
							<div style={{ width: 64, textAlign: 'right', fontSize: 12, color: 'var(--color-text-primary)' }}>{name}</div>
							<div style={{ height: 12, width: value, background: 'var(--color-primary)' }} />
							<code style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>{value}</code>
						</div>
					))}
				</div>
			</section>

			<section>
				<h2>Shadows</h2>
				<div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
					{['xs', 'sm', 'md', 'lg'].map((k) => (
						<Box key={k} style={{ width: 160, height: 80, background: 'var(--color-bg-primary)', borderRadius: 8, boxShadow: `var(--shadow-${k})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, border: '1px solid var(--color-border-light)', color: 'var(--color-text-primary)' }}>
							{k.toUpperCase()}
						</Box>
					))}
				</div>
			</section>
		</div>
	)
};
