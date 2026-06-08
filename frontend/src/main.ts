import { mount } from 'svelte';
import App from './App.svelte';
import V2App from './v2/V2App.svelte';
import V3App from './v3/V3App.svelte';

const target = document.getElementById('app');
if (!target) {
	throw new Error('App mount target "#app" was not found');
}

const props = {
	google_client_id: "GOOGLE_CLIENT_ID",
	stemma_backend_url: "STEMMA_BACKEND_URL",
};

const pathname = window.location.pathname;
const app = pathname.startsWith("/v3")
	? mount(V3App, { target, props })
	: pathname.startsWith("/v2")
	? mount(V2App, { target, props })
	: mount(App, { target, props });

export default app;
