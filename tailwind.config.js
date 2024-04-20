/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				spotify: {
					black: '#191414',
					green: { DEFAULT: '#1BD760', accent: '#1DDF63' }
				}
			}
		}
	},
	plugins: []
};
