<script lang="ts">
	import {
		getIsTrackSaved,
		getPlaybackState,
		likeTrack,
		pausePlayback,
		skipToNext,
		skipToPrevious,
		startPlayback,
		unlikeTrack,
		getSongLyrics
	} from '$lib/spotify';
	import { onDestroy, onMount } from 'svelte';
	import Vibrant from 'node-vibrant';
	import { SkipBack, SkipForward, Play, Pause, Heart, MicrophoneStage } from 'phosphor-svelte';
	import { formatLength } from '$lib/format-length';
	import { cn } from '$lib/cn';
	import { lyricsMode } from '../stores/lyrics-mode';

	const DEFAULT_COLOR = { background: 'black', text: 'white' };
	let data: Awaited<ReturnType<typeof getPlaybackState>> | null = null;

	$: trackId = data?.item.id;

	$: isTrackLikedPromise = trackId ? getIsTrackSaved(trackId) : undefined;

	let isMutating = false;

	let isPlaying = false;
	let progress = 0;

	$: songTitle = data?.item.name;
	$: artist = data?.item.artists.map((artist) => artist.name).join(', ');
	$: albumCover = data?.item.album.images.at(0)?.url;
	$: songLength = data?.item.duration_ms || 1; // to prevent division by zero

	let albumColor: { background: string; text: string } = { background: 'white', text: 'black' };

	$: !albumCover
		? undefined
		: Vibrant.from(albumCover)
				.getPalette()
				.then((palette) => {
					const swatches = palette.Vibrant;

					const background = swatches?.hex;
					const text = swatches?.getTitleTextColor();

					albumColor = background && text ? { background, text } : DEFAULT_COLOR;
				});

	const fetchPlaybackState = async () => {
		data = await getPlaybackState();
		if (!isMutating) {
			isPlaying = data?.is_playing;
			progress = data?.progress_ms;
		}
	};

	let pollTimeout: number;
	const poll = async () => {
		clearTimeout(pollTimeout);
		await fetchPlaybackState();
		// @ts-expect-error - i can't be bothered to check why ts is reacting like we're in node now that we import vibrant
		pollTimeout = setTimeout(poll, 1000);
	};
	onMount(poll);
	onDestroy(() => clearTimeout(pollTimeout));

	let lastUpdateTime = Date.now();
	const updateProgress = () => {
		if (isPlaying) {
			progress += Date.now() - lastUpdateTime;
			lastUpdateTime = Date.now();
		}
	};

	performance.now();

	let updateProgressInterval: number;
	const startProgressUpdate = () => {
		clearInterval(updateProgressInterval);
		// @ts-expect-error - i can't be bothered to check why ts is reacting like we're in node now that we import vibrant
		updateProgressInterval = setInterval(updateProgress, 100);
	};
	onMount(startProgressUpdate);
	onDestroy(() => clearInterval(updateProgressInterval));

	$: onPlayPause = async () => {
		lastUpdateTime = Date.now();
		isMutating = true;
		try {
			if (data?.is_playing) {
				isPlaying = false;
				await pausePlayback();
			} else {
				isPlaying = true;
				await startPlayback();
			}
		} finally {
			isMutating = false;
		}
	};

	const onPressPrevious = async () => {
		isMutating = true;
		try {
			await skipToPrevious();
			fetchPlaybackState();
		} finally {
			isMutating = false;
		}
	};

	const onPressNext = async () => {
		isMutating = true;
		try {
			await skipToNext();
			fetchPlaybackState();
		} finally {
			isMutating = false;
		}
	};

	const onPressLike = async () => {
		if (!trackId) return;

		isMutating = true;
		try {
			await likeTrack(trackId);
			isTrackLikedPromise = getIsTrackSaved(trackId);
		} finally {
			isMutating = false;
		}
	};

	const onPressUnlike = async () => {
		if (!trackId) return;

		isMutating = true;
		try {
			await unlikeTrack(trackId);
			isTrackLikedPromise = getIsTrackSaved(trackId);
		} finally {
			isMutating = false;
		}
	};

	$: lyricsPromise = $lyricsMode && trackId ? getSongLyrics(trackId) : undefined;

	let lyricsListElement: HTMLElement;
</script>

{#if !data}
	<p>...waiting</p>
{:else}
	<div class="h-screen w-screen flex flex-col justify-start items-center p-16 gap-8 relative">
		<div
			id="background"
			class="absolute inset-0 -z-10 saturate-[0.5]"
			style="background-color:{albumColor.background}"
		/>

		{#if !$lyricsMode}
			<div class="flex items-center flex-1 min-h-0 w-full">
				<div class="aspect-square h-full overflow-hidden rounded-2xl shrink-0">
					{#if albumCover}
						<img src={albumCover} alt="Album cover" class="object-cover w-full h-full" />
					{:else}
						<p>No album cover</p>
					{/if}
				</div>
				<div class="ml-12 space-y-4 flex-1 min-w-0" style="color:{albumColor.text}">
					<h1 class="text-7xl font-bold whitespace-nowrap truncate">{songTitle}</h1>
					<p class="text-6xl opacity-80 whitespace-nowrap truncate">{artist}</p>
				</div>
			</div>
		{/if}

		{#if $lyricsMode}
			<div class="flex-1 min-h-0 overflow-scroll relative">
				{#await lyricsPromise}
					<p>...loading lyrics</p>
				{:then lyrics}
					<div class="space-y-1" bind:this={lyricsListElement}>
						{#if lyrics}
							{#each lyrics as { startTimeMs, words }}
								<p
									class={cn(
										'font-bold text-4xl transition-opacity',
										startTimeMs > progress && 'opacity-30'
									)}
									style="color:{albumColor.text}"
								>
									{words}
								</p>
							{/each}
						{/if}
					</div>
				{:catch e}
					<p>Failed to load lyrics.</p>
				{/await}

				<!-- Bottom fade -->
				<div
					class="absolute bottom-0 inset-x-0 h-16 saturate-[0.5]"
					style="background: linear-gradient(transparent,{albumColor.background});"
				/>
			</div>
		{/if}

		<!-- Progress bar -->
		<div class="flex items-center justify-center w-full gap-2">
			<div class="text-lg">
				{formatLength(progress)}
			</div>
			<div class="w-4/5 relative h-1.5">
				<div
					class="absolute inset-0 rounded-full"
					style="background-color:{albumColor.text};width:{(progress / songLength) * 100}%"
				/>
				<div
					class="absolute inset-0 rounded-full opacity-40"
					style="background-color:{albumColor.text}"
				/>
			</div>
			<div class="text-lg">
				{formatLength(songLength || 0)}
			</div>
		</div>

		<div class="flex items-center gap-4 w-full">
			<div class="flex-1 flex justify-end items-center">
				<!-- Like button -->
				{#await isTrackLikedPromise}
					<div class="size-24 flex items-center justify-center">
						<Heart class="size-12 opacity-80" weight="regular" />
					</div>
				{:then isTrackLiked}
					<button
						class="size-24 rounded-full flex justify-center items-center"
						on:click={() => (isTrackLiked ? onPressUnlike() : onPressLike())}
					>
						<Heart
							class={cn('size-12', isTrackLiked ? 'text-spotify-green' : 'opacity-80')}
							weight={isTrackLiked ? 'fill' : 'regular'}
						/>
					</button>
				{:catch e}
					<div class="size-24 flex items-center justify-center">
						<Heart class="size-12 opacity-80" weight="regular" />
					</div>
				{/await}
			</div>

			<!-- Control buttons -->
			<button
				class="size-24 rounded-full flex justify-center items-center"
				on:click={onPressPrevious}
			>
				<SkipBack class="size-12 opacity-80" weight="fill" />
			</button>

			<button
				class="size-24 rounded-full flex justify-center items-center"
				style="background-color:{albumColor.text}"
				on:click={onPlayPause}
			>
				{#if isPlaying}
					<Pause class="size-12 invert" weight="fill" />
				{:else}
					<Play class="size-12 invert" weight="fill" />
				{/if}
			</button>

			<button class="size-24 rounded-full flex justify-center items-center" on:click={onPressNext}>
				<SkipForward class="size-12 opacity-80" weight="fill" />
			</button>

			<div class="flex-1 flex justify-start items-center">
				<button class="h-24" on:click={() => lyricsMode.update((v) => !v)}>
					<div
						class="rounded-full flex items-center border justify-center px-4 py-2 gap-3"
						style="border-color:{albumColor.text};"
					>
						<MicrophoneStage class="size-6" />
						<span class="font-semibold text-xl">Lyrics</span>
					</div>
				</button>
			</div>
		</div>
	</div>
{/if}
