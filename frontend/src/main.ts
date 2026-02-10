import { mount } from 'svelte';
import App from './App.svelte';

const target = document.getElementById('app');
if (!target) {
	throw new Error('App mount target "#app" was not found');
}

const app = mount(App, {
	target,
	props: {
		google_client_id: "GOOGLE_CLIENT_ID",
		stemma_backend_url: "STEMMA_BACKEND_URL"
	}
});

export default app;
