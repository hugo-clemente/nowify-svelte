import type { RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';

const BASE_URL = 'https://lrclib.net';

const getSongLyrics = async (params: {
	trackName: string;
	artistName: string;
	albumName: string;
	durationS: number;
}) => {
	const url = new URL('/api/get', BASE_URL);
	url.searchParams.set('track_name', params.trackName);
	url.searchParams.set('artist_name', params.artistName);
	url.searchParams.set('album_name', params.albumName);
	url.searchParams.set('duration', params.durationS.toString());

	const response = await fetch(url.toString());

	if (response.status === 404) return null;

	if (response.status !== 200) {
		const body = await response.json();
		console.log(body);
		throw new Error('Failed to get lyrics');
	}

	const body = await response.json();

	return body as {
		id: string;
		trackName: string;
		artistName: string;
		albumName: string;
		duration: number;
		instrumental: boolean;
		plainLyrics: string;
		syncedLyrics: string;
	};
};

const getSongLyricsSchema = z.object({
	trackName: z.string(),
	artistName: z.string(),
	albumName: z.string(),
	durationS: z.coerce.number()
});

const lyricLineRegex = /^\[((\d{2}):(\d{2})\.(\d{2}))\](.*)/;

export const GET: RequestHandler = async (event) => {
	const searchParams = new URLSearchParams(event.url.search);

	const parsed = getSongLyricsSchema.safeParse({
		trackName: searchParams.get('track_name'),
		artistName: searchParams.get('artist_name'),
		albumName: searchParams.get('album_name'),
		durationS: searchParams.get('duration')
	});

	if (!parsed.success) return new Response('Invalid request', { status: 400 });

	const params = parsed.data;

	const res = await getSongLyrics(params);

	if (res == null) return new Response('Lyrics not found', { status: 404 });

	const syncedLyrics = res?.syncedLyrics;

	const lines = syncedLyrics.split('\n').map((line) => {
		const match = lyricLineRegex.exec(line);
		if (!match) return null;

		const [, , minutes, seconds, milliseconds, words] = match;

		console.log(line);
		console.log({ minutes, seconds, milliseconds, words });

		const startTimeMs = Number(minutes) * 60 * 1000 + Number(seconds) * 1000 + Number(milliseconds);

		return {
			startTimeMs,
			words: words.trim()
		};
	}) as {
		startTimeMs: number;
		words: string;
	}[];

	console.log(lines);

	return new Response(JSON.stringify(lines));
};
