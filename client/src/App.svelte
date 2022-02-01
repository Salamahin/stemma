<script lang="ts">
	import Authenticate from "./components/Authenticate.svelte";
	export let name: string;
</script>

<main>
	<div class="authenticate-holder">
		<Authenticate />
	</div>
</main>

<style>
	main {
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
