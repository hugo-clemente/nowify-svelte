import { writable } from 'svelte/store';

const key = 'lyrics-mode';

const stored = Boolean(localStorage.getItem(key));

export const lyricsMode = writable(stored || false);

// Anytime the store changes, update the local storage value.
lyricsMode.subscribe((value) => localStorage.setItem(key, String(value)));
// or localStorage.setItem('content', value)
