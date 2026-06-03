<script lang="ts">
    import type { CreateNewPerson, PersonDescription } from "../../model";
    import { t } from "../../i18n";
    import { personDisplayName } from "../../personDisplayName";

    type Props = {
        selectedPeople?: (PersonDescription | CreateNewPerson)[];
        readOnly: boolean;
    };

    let { selectedPeople = $bindable([]), readOnly }: Props = $props();

    function remove(index: number) {
        selectedPeople = selectedPeople.filter((_, i) => i !== index);
    }
</script>

{#if !selectedPeople.length}
    <p class="text-center text-secondary fs-6">{$t('family.noInfo')}</p>
{:else}
    <table class="table">
        <tbody>
            {#each selectedPeople as p, i}
                <tr>
                    <th class="align-middle" scope="row">{i + 1}</th>
                    <td class="align-middle">{personDisplayName(p.name, $t)}</td>
                    <td class="align-middle">
                        {#if !readOnly}
                            <div class="float-end">
                                <button type="button" class="btn btn-sm btn-danger" aria-label={$t("common.delete")} onclick={() => remove(i)}><i class="bi bi-trash"></i></button>
                            </div>
                        {/if}
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
{/if}
