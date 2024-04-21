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
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import type { PlaybackState } from '$lib/spotify.types';
	import { derived } from 'svelte/store';
	import { CircleNotch } from 'phosphor-svelte';

	const DEFAULT_COLOR = { background: 'black', text: 'white' };

	const client = useQueryClient();

	let progress = 0;

	const playbackStateQuery = createQuery({
		queryKey: ['playback-state'],
		queryFn: async () => {
			const data = await getPlaybackState();
			return data;
		},
		refetchInterval: 1000,
		staleTime: 10_000
	});

	$: trackId = $playbackStateQuery.data?.item.id;

	const isTrackedLikedQuery = createQuery(
		derived(playbackStateQuery, ({ data }) => ({
			queryKey: ['is-track-liked', data?.item.id],
			//@ts-expect-error - this is fine
			queryFn: async ({ queryKey }) => {
				const [, trackId] = queryKey;
				if (!trackId) return false;

				const data = await getIsTrackSaved(trackId);
				return data;
			},
			enabled: !!trackId,
			refetchInterval: 20 * 1000, // 20 seconds
			staleTime: 60 * 60 * 1000 // 1 hour
		}))
	);

	$: songTitle = $playbackStateQuery.data?.item.name;
	$: artist = $playbackStateQuery.data?.item.artists.map((artist) => artist.name).join(', ');
	$: albumCover = $playbackStateQuery.data?.item.album.images.at(0)?.url;
	$: songLength = $playbackStateQuery.data?.item.duration_ms || 1; // to prevent division by zero
	$: isPlaying = $playbackStateQuery.data?.is_playing;

	$: {
		if ($playbackStateQuery.data?.progress_ms) progress = $playbackStateQuery.data.progress_ms;
	}

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

	let lastUpdateTime = Date.now();
	const updateProgress = () => {
		if (isPlaying) {
			progress += Date.now() - lastUpdateTime;
			lastUpdateTime = Date.now();
		}
	};

	let updateProgressInterval: number;
	const startProgressUpdate = () => {
		clearInterval(updateProgressInterval);
		// @ts-expect-error - i can't be bothered to check why ts is reacting like we're in node now that we import vibrant
		updateProgressInterval = setInterval(updateProgress, 100);
	};
	onMount(startProgressUpdate);
	onDestroy(() => clearInterval(updateProgressInterval));

	const playMutation = createMutation({
		mutationFn: startPlayback,
		onMutate: async () => {
			// Cancel any outgoing refetches (so they don't overwrite our optimistic update)
			await client.cancelQueries({ queryKey: ['playback-state'] });

			// Snapshot the previous value
			const previousState = client.getQueryData<PlaybackState>(['playback-state']);

			// Optimistically update to the new value
			if (previousState) {
				client.setQueryData<PlaybackState>(['playback-state'], {
					...previousState,
					is_playing: true
				});
			}

			return { previousState };
		},
		// If the mutation fails, use the context returned from onMutate to roll back
		onError: (_, __, context) => {
			if (context?.previousState) {
				client.setQueryData<PlaybackState>(['playback-state'], context.previousState);
			}
		}
	});

	const pauseMutation = createMutation({
		mutationFn: pausePlayback,
		onMutate: async () => {
			// Cancel any outgoing refetches (so they don't overwrite our optimistic update)
			await client.cancelQueries({ queryKey: ['playback-state'] });

			// Snapshot the previous value
			const previousState = client.getQueryData<PlaybackState>(['playback-state']);

			// Optimistically update to the new value
			if (previousState) {
				client.setQueryData<PlaybackState>(['playback-state'], {
					...previousState,
					is_playing: false
				});
			}

			return { previousState };
		},
		// If the mutation fails, use the context returned from onMutate to roll back
		onError: (_, __, context) => {
			if (context?.previousState) {
				client.setQueryData<PlaybackState>(['playback-state'], context.previousState);
			}
		}
	});

	const previousMutation = createMutation({
		mutationFn: skipToPrevious,
		onMutate: async () => {
			// Cancelling query because we're going to refetch it anyway
			await client.cancelQueries({ queryKey: ['playback-state'] });
		},
		onSuccess: () => {
			client.invalidateQueries({ queryKey: ['playback-state'] });
		}
	});

	const nextMutation = createMutation({
		mutationFn: skipToNext,
		onMutate: async () => {
			// Cancelling query because we're going to refetch it anyway
			await client.cancelQueries({ queryKey: ['playback-state'] });
		},
		onSuccess: () => {
			client.invalidateQueries({ queryKey: ['playback-state'] });
		}
	});

	const likeMutation = createMutation({
		mutationFn: likeTrack,
		onMutate: async (trackId: string) => {
			// Cancel any outgoing refetches (so they don't overwrite our optimistic update)
			await client.cancelQueries({ queryKey: ['is-track-liked', trackId] });

			// Snapshot the previous value
			const previousState = client.getQueryData<boolean>(['is-track-liked', trackId]);

			// Optimistically update to the new value
			client.setQueryData<boolean>(['is-track-liked', trackId], true);

			return { previousState };
		},
		// If the mutation fails, use the context returned from onMutate to roll back
		onError: (_, trackId, context) => {
			if (context) {
				client.setQueryData<boolean>(['is-track-liked', trackId], context.previousState);
			}
		}
	});

	const unlikeMutation = createMutation({
		mutationFn: unlikeTrack,
		onMutate: async (trackId: string) => {
			// Cancel any outgoing refetches (so they don't overwrite our optimistic update)
			await client.cancelQueries({ queryKey: ['is-track-liked', trackId] });

			// Snapshot the previous value
			const previousState = client.getQueryData<boolean>(['is-track-liked', trackId]);

			// Optimistically update to the new value
			client.setQueryData<boolean>(['is-track-liked', trackId], false);

			return { previousState, trackId };
		},
		// If the mutation fails, use the context returned from onMutate to roll back
		onError: (_, trackId, context) => {
			if (context) {
				client.setQueryData<boolean>(['is-track-liked', trackId], context.previousState);
			}
		}
	});

	const lyricsQuery = createQuery(
		derived(playbackStateQuery, ({ data }) => {
			return {
				queryKey: ['track-lyrics', data?.item.id],
				//@ts-expect-error - this is fine
				queryFn: async ({ queryKey }) => {
					const [, trackId] = queryKey;
					if (!trackId) return null;

					const data = await getSongLyrics(trackId);
					return data;
				},
				enabled: !!data?.item.id,
				staleTime: 7 * 24 * 60 * 60 * 1000 // 1 week
			};
		})
	);

	let lyricsListElement: HTMLElement;

	$: {
		if ($lyricsMode && $lyricsQuery.data) {
			const currentLyric = $lyricsQuery.data.findIndex(({ startTimeMs }) => startTimeMs > progress);

			lyricsListElement?.children.item(currentLyric)?.scrollIntoView({
				behavior: 'smooth',
				block: 'center'
			});
		}
	}
</script>

{#if $playbackStateQuery.isLoading}
	<p>...waiting</p>
{:else}
	<div class="h-screen w-screen flex flex-col justify-start items-center px-24 pb-16 relative">
		<div
			id="background"
			class="absolute inset-0 -z-10 saturate-[0.5] bottom-0"
			style="background-color:{albumColor.background}"
		/>

		{#if !$lyricsMode}
			<div class="flex items-center flex-1 min-h-0 w-full pt-24 mb-8">
				<div class="aspect-square h-full overflow-hidden rounded-2xl shrink-0">
					{#if albumCover}
						<img src={albumCover} alt="Album cover" class="object-cover w-full h-full" />
					{:else}
						<div class="w-full h-full bg-gray-300" />
					{/if}
				</div>
				<div class="ml-12 space-y-4 flex-1 min-w-0" style="color:{albumColor.text}">
					<h1 class="text-7xl font-bold whitespace-nowrap truncate">{songTitle}</h1>
					<p class="text-6xl opacity-80 whitespace-nowrap truncate">{artist}</p>
				</div>
			</div>
		{/if}

		{#if $lyricsMode && $playbackStateQuery.data}
			<div class="flex-1 min-h-0 relative w-full flex flex-col mb-4">
				<!-- Top fade -->
				<div
					class="absolute top-0 inset-x-0 h-24 saturate-[0.5] z-10"
					style="background: linear-gradient({albumColor.background},transparent);"
				/>

				<!-- Bottom fade -->
				<div
					class="absolute bottom-0 inset-x-0 h-8 saturate-[0.5] z-10"
					style="background: linear-gradient(transparent,{albumColor.background});"
				/>

				<div class="overflow-y-hidden flex-1 hover:overflow-y-auto">
					{#if $lyricsQuery.isLoading}
						<div class=" text-2xl pt-24 flex items-center gap-2">
							<CircleNotch class="size-4 animate-spin" />
							<p class="font-bold">Loading lyrics</p>
						</div>
					{:else if $lyricsQuery.data}
						<div class="space-y-1 pt-24 pb-8" bind:this={lyricsListElement}>
							{#each $lyricsQuery.data as { startTimeMs, words }}
								<p
									class={cn(
										'font-bold text-4xl transition-opacity',
										startTimeMs > progress && 'opacity-20'
									)}
									style="color:{albumColor.text}"
								>
									{words}
								</p>
							{/each}
						</div>
					{:else}
						<p class="font-bold text-4xl pt-24">
							No lyrics for this song. You'll have yo sing along by yourself!
						</p>
					{/if}
				</div>
			</div>
		{/if}

		<div class="w-full space-y-4">
			<!-- Progress bar -->
			<div class="flex items-center justify-center w-full gap-2">
				<div class="text-lg">
					{formatLength(progress)}
				</div>
				<div class="flex-1 relative h-1.5">
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
					{#if $lyricsMode}
						<div class="flex-1 flex items-center shrink-0 min-h-0 w-full">
							<div class="aspect-square h-20 overflow-hidden rounded-lg shrink-0">
								{#if albumCover}
									<img src={albumCover} alt="Album cover" class="object-cover w-full h-full" />
								{:else}
									<div class="w-full h-full bg-gray-300" />
								{/if}
							</div>
							<div class="ml-4 flex-1 min-w-0" style="color:{albumColor.text}">
								<h1 class="text-3xl font-bold whitespace-nowrap truncate">{songTitle}</h1>
								<p class="text-xl opacity-80 whitespace-nowrap truncate">{artist}</p>
							</div>
						</div>
					{/if}

					<!-- Like button -->
					{#if $isTrackedLikedQuery.data != null}
						<button
							class="size-24 rounded-full flex justify-center items-center disabled:opacity-50"
							disabled={!trackId}
							on:click={() => {
								if (trackId)
									$isTrackedLikedQuery.data
										? $unlikeMutation.mutate(trackId)
										: $likeMutation.mutate(trackId);
							}}
						>
							<Heart
								class={cn(
									'size-12 transition',
									$isTrackedLikedQuery.data ? 'text-spotify-green' : 'opacity-80'
								)}
								weight={$isTrackedLikedQuery.data ? 'fill' : 'regular'}
							/>
						</button>
					{:else}
						<div class="size-24 flex items-center justify-center">
							<Heart class="size-12 opacity-80" weight="regular" />
						</div>
					{/if}
				</div>

				<!-- Control buttons -->
				<button
					class="size-24 rounded-full flex justify-center items-center"
					on:click={() => $previousMutation.mutate()}
				>
					<SkipBack class="size-12 opacity-80" weight="fill" />
				</button>

				<button
					class="size-24 rounded-full flex justify-center items-center"
					style="background-color:{albumColor.text}"
					on:click={() => (isPlaying ? $pauseMutation.mutate() : $playMutation.mutate())}
				>
					{#if isPlaying}
						<Pause class="size-12 invert" weight="fill" />
					{:else}
						<Play class="size-12 invert" weight="fill" />
					{/if}
				</button>

				<button
					class="size-24 rounded-full flex justify-center items-center"
					on:click={() => $nextMutation.mutate()}
				>
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
	</div>
{/if}
