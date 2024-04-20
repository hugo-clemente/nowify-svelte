<script>
	import { redirectToLogin } from '$lib/spotify';
</script>

<div class="h-screen w-screen flex items-center justify-center">
	<div class="flex flex-col items-center bg-white text-black rounded-xl p-4 gap-3 w-72">
		<div class="self-start">
			<p class="text-xl font-semibold">👋 Hey there !</p>
			<p class="font-light text-sm">Let's get you started.</p>
		</div>
		<button
			on:click={() => redirectToLogin()}
			class="bg-spotify-green text-black px-4 py-2 rounded-full font-semibold hover:bg-spotify-green-accent hover:scale-105 transition w-full"
			>Log In</button
		>
	</div>
</div>
