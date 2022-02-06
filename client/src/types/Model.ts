import { createEventDispatcher } from "svelte";
const dispatch = createEventDispatcher();


type User = {
    token_id: string;
    image_url: string;
    name: string;
};

class StemmaModer {
    user: User;
    serviceHost: String;

    constructor(serviceHost: String) {
        this.serviceHost = serviceHost;
    }

    onSignIn(googleUser) {
        var profile = googleUser.getBasicProfile();
        this.user = {
            name: profile.getName() as string,
            image_url: profile.getImageUrl() as string,
            token_id: googleUser.getAuthResponse().id_token as string
        }
    }

    signOut() {
        this.user = null;
        dispatch("signOut");
    }
}
