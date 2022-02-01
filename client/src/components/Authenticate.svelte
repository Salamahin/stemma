<svelte:head>
    <script src="https://apis.google.com/js/platform.js" async defer></script>
    }
</svelte:head>

<div class="main-container">
    <div>
        <h1>project stemma</h1>
            <div
                class="g-signin2"
                id="sigin"
                data-longtitle="true"
                data-onsuccess="onSignIn"
                data-width="380"
                data-height="50"
            />
    </div>
</div>

<style>
    h1 {
        font-size: 4em;
        font-weight: 100;
        text-align: center;
        margin: 0 0 30px 0;
    }
    .main-container {
        backdrop-filter: blur(4px)  brightness(40%);
        color: ghostwhite;
        border-radius: 10px;
        padding: 40px 60px;
    }

    #siging {
        margin: auto;
    }
</style>
