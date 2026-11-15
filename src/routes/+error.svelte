<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
</script>

<main>
	<h1>{page.status}</h1>
	<p>{page.error?.message}</p>
	<a href={resolve('/')}>← Back to songs</a>
</main>

<style>
	main {
		max-width: 480px;
		margin: 4rem auto;
		padding: 1rem;
		text-align: center;
	}
	h1 {
		color: var(--muted);
		font-size: 3rem;
		margin: 0;
	}
	a {
		color: var(--accent);
	}
</style>
