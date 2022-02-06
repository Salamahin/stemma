type User = {
    token_id: string;
    image_url: string;
    name: string;
};

export let user: User;

export class StemmaModel {
    serviceHost: String;

    constructor(serviceHost: String) {
        this.serviceHost = serviceHost;
    }

    onSignIn(googleUser) {
        var profile = googleUser.getBasicProfile();
        user = {
            name: profile.getName() as string,
            image_url: profile.getImageUrl() as string,
            token_id: googleUser.getAuthResponse().id_token as string
        }
    }

    signOut() {
        user = null;
    }
}
