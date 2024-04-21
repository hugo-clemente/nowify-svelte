import { get, set, del } from 'idb-keyval';
import { experimental_createPersister } from '@tanstack/query-persist-client-core';

export const queryPersister = experimental_createPersister({
	storage: {
		getItem: async (key) => {
			const value = await get(key);
			return value;
		},
		setItem: async (key, value) => {
			await set(key, value);
		},
		removeItem: async (key) => {
			await del(key);
		}
	},
	maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
});
