import { Writable, writable } from 'svelte/store';

export type User = {
    token_id: string;
    image_url: string;
    name: string;
};

export const user: Writable<User> = writable(null)