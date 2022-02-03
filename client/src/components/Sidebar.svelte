<script lang="ts">
    import type { User } from "../types/User";
    export let user: User;
</script>

<div class="user">
    <img class="avatar" src={user.image_url} alt="avatar" />
    <h2 class="name">{user.name}</h2>
</div>

<style>
    .user {
        display: flex;
        justify-content: center;
        flex-direction: column;

        max-width: 300px;
        background-color: gray;
    }

    .avatar {
        border-radius: 50%;
        max-width: 100px;
        max-height: 100px;
        margin: 20px auto;
    }

    .name {
        margin: 0px auto 20px auto;
    }

</style>
