import { mount } from 'svelte';
import App from './App.svelte';
import V2App from './v2/V2App.svelte';

const target = document.getElementById('app');
if (!target) {
	throw new Error('App mount target "#app" was not found');
}

const props = {
	google_client_id: "GOOGLE_CLIENT_ID",
	stemma_backend_url: "STEMMA_BACKEND_URL",
};

const app = window.location.pathname.startsWith("/v2")
	? mount(V2App, { target, props })
	: mount(App, { target, props });

export default app;
