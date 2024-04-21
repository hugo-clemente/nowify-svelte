<script>
	import { queryPersister } from '$lib/query-persister';
	import '../app.css';

	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import { SvelteQueryDevtools } from '@tanstack/svelte-query-devtools';

	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				persister: queryPersister
			}
		}
	});
</script>

<QueryClientProvider client={queryClient}>
	<slot />
	<SvelteQueryDevtools />
</QueryClientProvider>
