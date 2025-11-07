import 'bootstrap/dist/css/bootstrap.min.css';
import '../src/index.css';
import '../src/styles/theme.css';
import '../src/styles/design-tokens.css';
import '../src/styles/utilities.css';
import '../src/styles/accessibility.css';
import '../src/styles/alerts.css';
import '../src/styles/animations.css';
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
				} else {
					root.style.colorScheme = 'light';
					root.removeAttribute('data-theme');
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