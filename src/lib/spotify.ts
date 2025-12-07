import type { PlaybackState } from './spotify.types';
import { PUBLIC_SPOTIFY_CLIENT_ID, PUBLIC_HOSTED_URL } from '$env/static/public';
import { goto } from '$app/navigation';

const HOSTED_URL = PUBLIC_HOSTED_URL || 'http://127.0.0.1:5173';
const CLIENT_ID = PUBLIC_SPOTIFY_CLIENT_ID as string;

const getRedirectUri = () => {
	const redirectUri = `${HOSTED_URL}/auth`;
	return redirectUri;
};

const generateRandomString = (length: number) => {
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const values = crypto.getRandomValues(new Uint8Array(length));
	return values.reduce((acc, x) => acc + possible[x % possible.length], '');
};

const sha256 = async (plain: string) => {
	const encoder = new TextEncoder();
	const data = encoder.encode(plain);
	return window.crypto.subtle.digest('SHA-256', data);
};

const base64encode = (input: ArrayBufferLike) => {
	return btoa(String.fromCharCode(...new Uint8Array(input)))
		.replace(/=/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_');
};

const redirectToLogin = async () => {
	const authUrl = new URL('https://accounts.spotify.com/authorize');

	const redirectUri = getRedirectUri();

	const scope =
		'user-read-private user-read-email user-read-playback-state user-modify-playback-state user-read-currently-playing user-library-modify user-library-read';

	const codeVerifier = generateRandomString(64);
	const hashed = await sha256(codeVerifier);
	const codeChallenge = base64encode(hashed);

	// generated in the previous step
	window.localStorage.setItem('code_verifier', codeVerifier);

	const params = {
		response_type: 'code',
		client_id: CLIENT_ID,
		scope,
		code_challenge_method: 'S256',
		code_challenge: codeChallenge,
		redirect_uri: redirectUri
	};

	authUrl.search = new URLSearchParams(params).toString();
	window.location.href = authUrl.toString();
};

const parseAuthResponse = async () => {
	const authUrl = new URL('https://accounts.spotify.com/api/token');

	const redirectUri = getRedirectUri();
	const url = new URL(window.location.href);
	const code = url.searchParams.get('code');
	const codeVerifier = localStorage.getItem('code_verifier');

	if (!code) {
		return {
			success: false,
			error: 'No code found in URL'
		};
	}

	if (!codeVerifier) {
		return {
			success: false,
			error: 'No code verifier found in local storage'
		};
	}

	const payload = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			client_id: CLIENT_ID,
			grant_type: 'authorization_code',
			code,
			redirect_uri: redirectUri,
			code_verifier: codeVerifier
		})
	};

	const response = await fetch(authUrl, payload);
	const body = await response.json();

	localStorage.setItem('access_token', body.access_token);
	localStorage.setItem('expires_at', String(Date.now() + body.expires_in * 1000));
	localStorage.setItem('refresh_token', body.refresh_token);

	return {
		success: true
	};
};

const refreshTokens = async () => {
	const authUrl = 'https://accounts.spotify.com/api/token';
	const refreshToken = localStorage.getItem('refresh_token');

	if (!refreshToken) {
		return {
			success: false,
			error: 'No refresh token found in local storage'
		};
	}

	const payload = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
			client_id: CLIENT_ID
		})
	};
	const response = await fetch(authUrl, payload);

	if (response.status !== 200) {
		return {
			success: false,
			error: 'Failed to refresh tokens.'
		};
	}

	const body = await response.json();

	localStorage.setItem('access_token', body.access_token);
	localStorage.setItem('expires_at', String(Date.now() + body.expires_in * 1000));
	localStorage.setItem('refresh_token', body.refresh_token);

	return {
		success: true
	};
};

// Returns a valid access token, refreshing if necessary
const getAccessToken = async () => {
	const accessToken = localStorage.getItem('access_token');
	const expiresAt = Number(localStorage.getItem('expires_at'));

	if (
		!accessToken ||
		!expiresAt ||
		Date.now() > expiresAt - 20 * 1000 // Adding a 20 second buffer to account for network latency
	) {
		const refreshResult = await refreshTokens();
		if (!refreshResult.success) {
			goto('/start');
			console.error('Failed to refresh tokens. Redirecting to login.');
			return null;
		}
	}

	return localStorage.getItem('access_token')!;
};

const isLoggedIn = () => {
	const accessToken = localStorage.getItem('access_token');
	return !!accessToken;
};

const getIsTrackSaved = async (trackId: string) => {
	const endpoint = `https://api.spotify.com/v1/me/tracks/contains?ids=${trackId}`;

	const accessToken = await getAccessToken();

	const payload = {
		headers: {
			Authorization: `Bearer ${accessToken}`
		}
	};

	const response = await fetch(endpoint, payload);

	if (response.status !== 200) {
		throw new Error('Failed to get track saved state');
	}

	const body = await response.json();

	return body[0] as boolean;
};

const getPlaybackState = async () => {
	const endpoint = 'https://api.spotify.com/v1/me/player';

	const accessToken = await getAccessToken();

	const payload = {
		headers: {
			Authorization: `Bearer ${accessToken}`
		}
	};

	const response = await fetch(endpoint, payload);
	const body = await response.json();

	return body as PlaybackState;
};

const startPlayback = async () => {
	const endpoint = 'https://api.spotify.com/v1/me/player/play';

	const accessToken = await getAccessToken();

	const payload = {
		method: 'PUT',
		headers: {
			Authorization: `Bearer ${accessToken}`
		}
	};

	const response = await fetch(endpoint, payload);

	if (response.status !== 204) throw new Error('Failed to start playback');
};

const pausePlayback = async () => {
	const endpoint = 'https://api.spotify.com/v1/me/player/pause';

	const accessToken = await getAccessToken();

	const payload = {
		method: 'PUT',
		headers: {
			Authorization: `Bearer ${accessToken}`
		}
	};

	const response = await fetch(endpoint, payload);

	if (response.status !== 204) throw new Error('Failed to pause playback');
};

const skipToNext = async () => {
	const endpoint = 'https://api.spotify.com/v1/me/player/next';

	const accessToken = await getAccessToken();

	const payload = {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${accessToken}`
		}
	};

	const response = await fetch(endpoint, payload);

	if (response.status !== 204) throw new Error('Failed to skip to next track');
};

const skipToPrevious = async () => {
	const endpoint = 'https://api.spotify.com/v1/me/player/previous';

	const accessToken = await getAccessToken();

	const payload = {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${accessToken}`
		}
	};

	const response = await fetch(endpoint, payload);

	if (response.status !== 204) throw new Error('Failed to skip to previous track');
};

const likeTrack = async (trackId: string) => {
	const endpoint = `https://api.spotify.com/v1/me/tracks?ids=${trackId}`;

	const accessToken = await getAccessToken();

	const payload = {
		method: 'PUT',
		headers: {
			Authorization: `Bearer ${accessToken}`
		}
	};

	const response = await fetch(endpoint, payload);

	if (response.status !== 200) throw new Error('Failed to like track');

	return true;
};

const unlikeTrack = async (trackId: string) => {
	const endpoint = `https://api.spotify.com/v1/me/tracks?ids=${trackId}`;

	const accessToken = await getAccessToken();

	const payload = {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${accessToken}`
		}
	};

	const response = await fetch(endpoint, payload);

	if (response.status !== 200) throw new Error('Failed to unlike track');

	return true;
};

const getSongLyrics = async (
	trackName: string,
	artistName: string,
	albumName: string,
	durationS: number
) => {
	const url = `${window.origin}/api/lyrics?track_name=${trackName}&artist_name=${artistName}&album_name=${albumName}&duration=${durationS}`;

	const response = await fetch(url);
	if (response.status === 404) return null;

	if (response.status !== 200) throw new Error('Failed to get lyrics');

	const body = await response.json();

	return body as [{ startTimeMs: number; words: string }];
};

export {
	redirectToLogin,
	parseAuthResponse,
	isLoggedIn,
	getIsTrackSaved,
	getPlaybackState,
	startPlayback,
	pausePlayback,
	skipToNext,
	skipToPrevious,
	likeTrack,
	unlikeTrack,
	getSongLyrics
};
