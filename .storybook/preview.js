// Optional Storybook preview decorator to force animations for demos.
// Usage: set env var `STORYBOOK_FORCE_ANIMATIONS=true` when running Storybook.
// This will inject a small stylesheet in the preview iframe that overrides
// the project's `prefers-reduced-motion: reduce` rule so animations are visible
// for demonstration. Do NOT enable this in production environments.

// Do not import React here — Storybook concatenates preview files and the
// project's existing preview imports React already, which can cause a
// duplicate-declaration parse error. Use the Story function directly.

const injectForceAnimationsStyle = () => {
  if (typeof document === 'undefined') return;
  const id = 'biensperience-force-animations';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  // This rule will be appended after other styles in the preview iframe,
  // so its !important declarations will override earlier reduced-motion rules.
  style.innerHTML = `
/* Force animations in the preview iframe when requested */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    /* restore sensible durations for demo */
    animation-duration: 0.32s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.32s !important;
    /* allow animations that use shorthand */
    animation-delay: 0s !important;
  }
}
`;
  document.head.appendChild(style);
};

export const decorators = [
  (Story) => {
    try {
      const force = (typeof window !== 'undefined' && window.STORYBOOK_FORCE_ANIMATIONS === 'true') ||
        process.env.STORYBOOK_FORCE_ANIMATIONS === 'true';
      if (force) injectForceAnimationsStyle();
    } catch (err) {
      // ignore - best effort only
      // eslint-disable-next-line no-console
      console.warn('Could not inject force-animations stylesheet', err);
    }
		// Return the Story function (avoid JSX here to remove React import requirement)
		return Story();
  }
];

// Optional parameters or global decorators can be added below.
import 'bootstrap/dist/css/bootstrap.min.css';
import '../src/index.scss';
import '../src/styles/theme.scss';
import '../src/styles/design-tokens.css';
import '../src/styles/utilities.scss';
import '../src/styles/accessibility.scss';
import '../src/styles/alerts.scss';
import '../src/styles/animations.scss';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { UserProvider } from '../src/contexts/UserContext';
import { DataProvider } from '../src/contexts/DataContext';
import { ToastProvider } from '../src/contexts/ToastContext';

/** @type { import('@storybook/react').Preview } */
const preview = {
	parameters: {
		actions: { argTypesRegex: "^on[A-Z].*" },
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
			expanded: true,
		},
		backgrounds: {
			default: 'light',
			values: [
				{ name: 'light', value: 'var(--color-bg-primary, #ffffff)' },
				{ name: 'dark', value: '#121212' },
				{ name: 'gradient', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
			],
		},
		viewport: {
			viewports: {
				mobile: { name: 'Mobile', styles: { width: '375px', height: '667px' } },
				tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' } },
				desktop: { name: 'Desktop', styles: { width: '1440px', height: '900px' } },
			},
		},
		docs: { toc: true },
		options: {
			storySort: {
				order: [
					'Introduction',
					'Design System',
					['Design Tokens', 'Buttons', 'Design Utilities'],
					'Components',
					['Alert', 'FormField', 'Loading', 'Modal', '*'],
				],
			},
		},
	},
	globalTypes: {
		theme: {
			name: 'Theme',
			description: 'Global theme for components',
			defaultValue: 'light',
			toolbar: {
				icon: 'circlehollow',
				items: [
					{ value: 'light', icon: 'sun', title: 'Light Mode' },
					{ value: 'dark', icon: 'moon', title: 'Dark Mode' },
				],
				showName: true,
				dynamicTitle: true,
			},
		},
	},
	decorators: [
		(Story, context) => {
			const theme = context.globals.theme || 'light';
			if (typeof document !== 'undefined') {
				const root = document.documentElement;
				if (theme === 'dark') {
					root.style.colorScheme = 'dark';
					root.setAttribute('data-theme', 'dark');
					try { root.setAttribute('data-bs-theme', 'dark'); } catch (e) { /* ignore */ }
				} else {
					root.style.colorScheme = 'light';
					root.setAttribute('data-theme', 'light');
					try { root.setAttribute('data-bs-theme', 'light'); } catch (e) { /* ignore */ }
				}
			}

			const containerStyle = {
				backgroundColor: theme === 'dark' ? '#121212' : '#ffffff',
				color: theme === 'dark' ? '#f8f9fa' : '#1a202c',
				minHeight: '100vh',
				padding: '2rem',
			};

			return React.createElement(
				MemoryRouter,
				{ initialEntries: ['/'] },
				React.createElement(
					UserProvider,
					null,
					React.createElement(
						DataProvider,
						null,
						React.createElement(
							ToastProvider,
							null,
							React.createElement(
								'div',
								{ style: containerStyle },
								React.createElement(Story, null)
							)
						)
					)
				)
			);
		},
	],
};

export default preview;