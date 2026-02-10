<script lang="ts">
    import * as bootstrap from "bootstrap";
    import { t } from "../../i18n";
    let modalEl;
    export function show() {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
</script>

<div class="modal fade" id="aboutModal" tabindex="-1" aria-hidden="true" bind:this={modalEl}>
    <div class="modal-dialog modal-lg modal-dialog-centered modal-fullscreen-lg-down">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="addStemmaLabel">{$t("about.title")}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <img src="assets/logo_color.webp" alt="" width="100" height="100" class="mx-auto d-block" />

                <div class="mt-4">
                    <h6>{$t("about.heading")}</h6>
                    <p>{$t("about.intro")}</p>
                </div>

                <div class="mt-4">
                    <h6>{$t("about.familyRulesTitle")}</h6>
                    <p>{$t("about.familyRulesIntro")}</p>
                    <img src="assets/family_about.webp" alt="" width="350" class="mx-auto d-block" />
                    <p>{$t("about.familyRulesNote")}</p>
                    <ul>
                        <li>{$t("about.rule1")}</li>
                        <li>{$t("about.rule2")}</li>
                        <li>{$t("about.rule3")}</li>
                        <li>{$t("about.rule4")}</li>
                        <li>{$t("about.rule5")}</li>
                        <li>{$t("about.rule6")}</li>
                        <li>{$t("about.rule7")}</li>
                        <li>{$t("about.rule8")}</li>
                        <li>{$t("about.rule9")}</li>
                    </ul>
                </div>

                <div class="mt-4">
                    <h6>{$t("about.namesakesTitle")}</h6>
                    <p>{$t("about.namesakesText")}</p>
                </div>
                <div class="mt-4">
                    <h6>{$t("about.sharingTitle")}</h6>
                    <p>{$t("about.sharingText1")}</p>
                    <p>{$t("about.sharingText2")}</p>
                    <p>
                        <b>{$t("about.sharingWarning")}</b>{$t("about.sharingWarningText")} <i>@gmail.com</i>
                    </p>
                </div>
                <div class="mt-4">
                    <h6>{$t("about.problemsTitle")}</h6>
                    <p>
                        {$t("about.problemsText")}
                        <a href="mailto:danilasergeevich@gmail.com?subject=stemma">{$t("about.problemsEmail")}</a>.
                    </p>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">{$t("common.ok")}</button>
            </div>
        </div>
    </div>
</div>
