import { writable } from 'svelte/store';

const key = 'lyrics-mode';

const stored = JSON.parse(localStorage.getItem(key) || 'false') as boolean;

export const lyricsMode = writable(stored);

// Anytime the store changes, update the local storage value.
lyricsMode.subscribe((value) => localStorage.setItem(key, JSON.stringify(value)));
// or localStorage.setItem('content', value)
