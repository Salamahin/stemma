<script lang="ts">
	import Authenticate from "./components/Authenticate.svelte";
	import Navbar from "./components/Navbar.svelte";
	import type { User } from "./User";
	import { user } from "./User";

	let signedInUser: User;
	user.subscribe((u) => {
		signedInUser = u;
	});
</script>

<main>
	{#if !signedInUser}
	<div class="authenticate-bg">
		<div class="authenticate-holder">
			<Authenticate
				google_client_id="892655929422-dcdrfg3o02637q2n5h8l1j20hlvm5mib"
			/>
		</div>
	</div>
		
	{:else}
		<Navbar user={signedInUser} on:signOut={() => user.set(null)} />
	{/if}
	<script src="vendor/bootstrap/js/bootstrap.bundle.min.js"></script>
</main>

<style>
	main {
		height: 100%;
	}

	.authenticate-bg {
		background-image: url("/assets/bg.webp");
		height: 100%;
		background-position: center;
		background-repeat: no-repeat;
		background-size: cover;
	}

	.authenticate-holder {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
		height: 100%;
	}
</style>
