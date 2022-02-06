<script lang="ts">
	import Authenticate from "./components/Authenticate.svelte";
	import Navbar from "./components/Navbar.svelte";
	import type { User } from "./types/User";

	let auth;

	let user: User = null;
	function handeSignIn(event: CustomEvent<any>) {
		user = {
			token_id: event.detail.token_id as string,
			image_url: event.detail.image_url as string,
			name: event.detail.name as string,
		};
	}
	function handleSignOut() {
		user = null;
	}
</script>

<main>
	{#if !user}
		<div class="authenticate-holder">
			<Authenticate
				bind:this={auth}
				on:signIn={handeSignIn}
				on:signOut={handleSignOut}
				google_client_id="892655929422-dcdrfg3o02637q2n5h8l1j20hlvm5mib"
			/>
		</div>
	{:else}
		<Navbar {user} on:signOut={() => auth.signOut()} />
	{/if}
	<script src="vendor/bootstrap/js/bootstrap.bundle.min.js"></script>
</main>

<style>
	/* main {
		background-image: url("/assets/bg.webp");
		height: 100%;
		background-position: center;
		background-repeat: no-repeat;
		background-size: cover;
	} */

	/* .authenticate-holder {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
		height: 100%;
	} */
</style>
