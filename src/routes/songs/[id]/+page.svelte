<script lang="ts">
	import SongView from './SongView.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<!-- Re-create the view per song so moving through a setlist starts with fresh state. -->
{#key `${data.song.id}:${data.setlist?.pos ?? ''}`}
	<SongView {data} />
{/key}
