<script lang="ts">
	import { onMount } from 'svelte';

	import { parseAuthResponse, redirectToLogin } from '$lib/spotify';
	import { CircleNotch } from 'phosphor-svelte';
	import { goto } from '$app/navigation';

	let state: 'pending' | 'error' | 'success' = 'pending';

	onMount(async () => {
		const res = await parseAuthResponse();
		state = res.success ? 'success' : 'error';

		if (res.success) {
			goto('/');
		}
	});
</script>

{#if state === 'error'}
	<div class="h-screen w-screen flex justify-center items-center">
		<div class="flex flex-col items-center bg-white text-black rounded-xl p-4 gap-3">
			<p class="text-lg font-semibold">An error occurred !</p>
			<button
				on:click={() => redirectToLogin()}
				class="px-4 py-2 rounded-full bg-red-600 font-semibold hover:scale-105 hover:bg-red-500 transition"
				>Try again</button
			>
		</div>
	</div>
{:else}
	<div class="h-screen w-screen flex justify-center items-center">
		<div class="px-4 py-2 flex items-center rounded-full text-white gap-2">
			<CircleNotch class="animate-spin size-6" />
			<p class="text-lg">Logging you in...</p>
		</div>
	</div>
{/if}
