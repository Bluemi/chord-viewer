<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { loginProof } from '#lib/sha256.ts';

	let password = $state('');
	let errorMsg = $state('');
	let busy = $state(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		errorMsg = '';
		try {
			const { nonce } = await (await fetch('/api/auth/challenge')).json();
			// Only an HMAC of the nonce is sent; the password never leaves the browser.
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ nonce, proof: loginProof(password, nonce) })
			});
			if (res.ok) {
				password = '';
				await goto(resolve('/'), { invalidateAll: true });
			} else {
				errorMsg = 'Wrong password';
			}
		} catch {
			errorMsg = 'Login failed';
		} finally {
			busy = false;
		}
	}
</script>

<main>
	<form onsubmit={submit}>
		<h1>Chord Viewer</h1>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			type="password"
			bind:value={password}
			placeholder="Password"
			autofocus
			autocomplete="current-password"
		/>
		<button class="primary" disabled={busy || !password}>Log in</button>
		{#if errorMsg}<p class="err">{errorMsg}</p>{/if}
	</form>
</main>

<style>
	main {
		min-height: 100vh;
		display: grid;
		place-items: center;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: min(320px, 90vw);
	}
	h1 {
		text-align: center;
		font-weight: 600;
	}
	input {
		font: inherit;
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--panel);
		color: var(--fg);
	}
	.err {
		color: var(--danger);
		text-align: center;
		margin: 0;
	}
</style>
