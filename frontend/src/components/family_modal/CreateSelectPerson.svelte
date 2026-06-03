<script lang="ts">
    import type { Stemma, CreateNewPerson, PersonDescription } from "../../model";
    import { StemmaIndex } from "../../stemmaIndex";
    import Select from "svelte-select";
    import ClearIcon from "../misc/ClearIconTranslated.svelte";
    import PersonSelector from "../misc/PersonSelector.svelte";
    import { t } from "../../i18n";
    import { filterEditablePeople } from "../../personSelectionRules";
    import { isUnknownPerson, personDisplayName } from "../../personDisplayName";

    type Props = {
        stemmaIndex: StemmaIndex;
        stemma: Stemma;
        onselected?: (person: CreateNewPerson | PersonDescription) => void;
    };

    let { stemmaIndex, stemma, onselected }: Props = $props();

    let namesakes = $state<(CreateNewPerson | PersonDescription)[]>([]);
    let selectedPerson = $state<CreateNewPerson | PersonDescription>(null);
    let filterText = $state("");
    let unknown = $state(false);

    type SelectItem = { label: string; value: string; isCreator?: boolean };

    const peopleNames = $derived(
        stemma ? [...new Set(filterEditablePeople(stemma.people).map((p) => p.name).filter((n) => !isUnknownPerson(n)))] : []
    );

    const peopleItems = $derived.by(() => {
        const items: SelectItem[] = peopleNames.map((name) => ({ label: name, value: name }));
        if (filterText && !peopleNames.includes(filterText)) {
            items.push({
                label: $t("family.createOption", { name: filterText }),
                value: filterText,
                isCreator: true,
            });
        }
        return items;
    });

    const selectedItem = $derived<SelectItem | null>(
        selectedPerson ? { label: personDisplayName(selectedPerson.name, $t), value: selectedPerson.name } : null
    );

    function personSelected(p: CreateNewPerson | PersonDescription) {
        selectedPerson = p;
        onselected?.(p);
    }

    function nameChanged(newName: string) {
        namesakes = [...stemmaIndex.namesakes(newName).filter((p) => !p.readOnly), { type: "CreateNewPerson", name: newName }];
    }

    export function reset() {
        namesakes = [];
        selectedPerson = null;
        filterText = "";
        unknown = false;
    }

    function toggleUnknown() {
        if (unknown) {
            const unknownPerson: CreateNewPerson = { type: "CreateNewPerson", name: "" };
            namesakes = [unknownPerson];
            personSelected(unknownPerson);
        } else {
            namesakes = [];
            selectedPerson = null;
            onselected?.(null);
        }
    }

    function handleSelect(e: any) {
        const detail = e?.detail as SelectItem | undefined;
        const value = detail?.value ?? detail?.label ?? "";
        if (value) nameChanged(value);
    }
</script>

<div class="container h-100">
    <div class="d-flex flex-column h-100">
        <div class="flex-shrink-1">
            <label for="personName" class="form-label">{$t('family.fullName')}</label>
            <Select
                id="personName"
                placeholder={$t('family.namePlaceholder')}
                items={peopleItems}
                searchable={true}
                bind:filterText={filterText}
                on:select={handleSelect}
                on:clear={() => reset()}
                hideEmptyState={true}
                value={selectedItem}
                disabled={unknown}
            >
                <svelte:fragment slot="clear-icon">
                    <ClearIcon />
                </svelte:fragment>
            </Select>
            <div class="form-check form-switch mt-2">
                <input
                    class="form-check-input"
                    type="checkbox"
                    id="createPersonUnknownSwitch"
                    bind:checked={unknown}
                    onchange={toggleUnknown}
                />
                <label class="form-check-label" for="createPersonUnknownSwitch">{$t("person.unknownToggle")}</label>
            </div>
        </div>
        <div class="flex-grow-1 mt-2 mb-2" style="min-height:400px">
            <PersonSelector people={namesakes} {stemmaIndex} onselect={personSelected} />
        </div>
    </div>
</div>
