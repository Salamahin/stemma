import App from './App.svelte';

const app = new App({
	target: document.getElementsByTagName("App")[0],
	props: {
		google_client_id: GOOGLE_CLIENT_ID,
		stemma_backend_url: STEMMA_BACKEND_URL
	}
});

export default app;