import { isLoggedIn } from '$lib/spotify';
import { redirect } from '@sveltejs/kit';

import type {} from './$types';

export const ssr = false;

export const load = () => {
	const isUserLoggedIn = isLoggedIn();

	if (!isUserLoggedIn) {
		redirect(307, '/start');
	}
};
