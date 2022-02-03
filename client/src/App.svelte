<script lang="ts">
	import Authenticate from "./components/Authenticate.svelte";
	import Sidebar from "./components/Sidebar.svelte";
	import type { Graph } from "./components/Sidebar.svelte";

	let token_id: string;
	function handeSignIn(event: CustomEvent<any>) {
		token_id = event.detail as string;
	}
	function handleSignOut() {
		token_id = null;
	}

	// let g1: Graph = { name: "Голощаповы", id: "123" };
	// let g2: Graph = { name: "Сулеровы", id: "222" };
	// let gg = [g1, g2];
	// let selected_graph_id = "123";
</script>

<main>
	{#if !token_id}
		<div class="authenticate-holder">
			<Authenticate
				on:signIn={handeSignIn}
				on:signOut={handleSignOut}
				google_client_id={"892655929422-dcdrfg3o02637q2n5h8l1j20hlvm5mib"}
			/>
		</div>
	{/if}
	<Sidebar />
</main>

<style>
	main {
		/* background-image: url("/assets/bg.webp"); */
		/* height: 100%; */
		/* background-position: center; */
		/* background-repeat: no-repeat; */
		/* background-size: cover; */
	}

	.authenticate-holder {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
		height: 100%;
	}
</style>
