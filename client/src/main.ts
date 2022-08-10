import App from './App.svelte';

const app = new App({
	target: document.getElementsByTagName("App")[0],
	props: {
		google_client_id: "584519661541-m7jkpf0o4cu08jpiq4eo4bmaoa6ah7j1",
		stemma_backend_url: "https://api.stemma.link"
	}
});

export default app;