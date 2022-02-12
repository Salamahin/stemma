import App from './App.svelte';

const app = new App({
	target: document.body,
	props: {
		google_client_id: "892655929422-dcdrfg3o02637q2n5h8l1j20hlvm5mib",
		stemma_backend_url: "http://localhost:8090"
	}
});

export default app;