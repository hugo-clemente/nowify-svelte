import type { RequestHandler } from '@sveltejs/kit';

import { env } from '$env/dynamic/private';

// Inspired by https://github.com/aviwad/LyricFever/blob/682b60f0b1907d728c3975a015a6b165b2785ced/SpotifyLyricsInMenubar/viewModel.swift and https://github.com/raitonoberu/lyricsapi/blob/659da1d2b9064997562ddec8586f2aefd9254d42/lyrics/lyrics.go

const COOKIE = env.SP_DC;
const userAgent = 'Spotify/121000760 Win32/0 (PC laptop)';

const getAccessToken = async () => {
	const tokenUrl =
		'https://open.spotify.com/get_access_token?reason=transport&productType=web_player';

	const payload = {
		headers: {
			referer: 'https://open.spotify.com/',
			origin: 'https://open.spotify.com/',
			accept: 'application/json',
			'accept-language': 'en',
			'app-platform': 'WebPlayer',
			'sec-ch-ua-mobile': '?0',
			'user-agent': userAgent,
			'sec-fetch-dest': 'empty',
			'sec-fetch-mode': 'cors',
			'sec-fetch-site': 'same-origin',
			'spotify-app-version': '1.1.54.35.ge9dace1d',
			cookie: `sp_dc=${COOKIE}`
		}
	};

	const body = await fetch(tokenUrl, payload);

	if (body.status !== 200) throw new Error('Failed to get access token');

	const response = await body.json();

	return response.accessToken;
};

const getSongLyrics = async (trackId: string) => {
	const endpoint = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${trackId}`;

	const token = await getAccessToken();

	const payload = {
		headers: {
			referer: 'https://open.spotify.com/',
			origin: 'https://open.spotify.com/',
			accept: 'application/json',
			// 'accept-language': 'en',
			// 'sec-ch-ua-mobile': '?0',
			'user-agent': userAgent,
			'app-platform': 'WebPlayer',
			authorization: `Bearer ${token}`
		}
	};

	const response = await fetch(endpoint, payload);

	if (response.status === 404) return null;

	if (response.status !== 200) throw new Error('Failed to get lyrics');

	const body = await response.json();

	return body;

	// const endpoint = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${trackId}`;
};

export const GET: RequestHandler = async ({ params }) => {
	const { trackId } = params;

	if (!trackId) {
		return new Response('Track ID is required', { status: 400 });
	}

	const res = await getSongLyrics(trackId);

	if (res == null) return new Response('Lyrics not found', { status: 404 });

	const lines = res?.lyrics.lines as {
		startTimeMs: number;
		words: string;
	};

	return new Response(JSON.stringify(lines));
};
