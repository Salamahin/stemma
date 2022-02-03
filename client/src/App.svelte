<script lang="ts">
	import Authenticate from "./components/Authenticate.svelte";
	import Sidebar from "./components/Sidebar.svelte";

	type User = {
		token_id: string;
		image_url: string;
		name: string;
	};

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

	// let g1: Graph = { name: "Голощаповы", id: "123" };
	// let g2: Graph = { name: "Сулеровы", id: "222" };
	// let gg = [g1, g2];
	// let selected_graph_id = "123";
</script>

<main>
	{#if !user}
		<div class="authenticate-holder">
			<Authenticate
				on:signIn={handeSignIn}
				on:signOut={handleSignOut}
				google_client_id="892655929422-dcdrfg3o02637q2n5h8l1j20hlvm5mib"
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
