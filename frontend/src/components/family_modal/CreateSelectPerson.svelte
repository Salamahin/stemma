<script lang="ts">
  import type { Stemma, CreateNewPerson, PersonDescription } from "../../model";
  import { StemmaIndex } from "../../stemmaIndex";
  import Select from "svelte-select";
  import ClearIcon from "../misc/ClearIconTranslated.svelte";
  import { createEventDispatcher } from "svelte";
  import PersonSelector from "../misc/PersonSelector.svelte";
  import { t } from "../../i18n";
  import { filterEditablePeople } from "../../personSelectionRules";

  export let stemmaIndex: StemmaIndex;
  export let stemma: Stemma;

  let namesakes: (CreateNewPerson | PersonDescription)[] = [];
  let selectedPerson: CreateNewPerson | PersonDescription;
  let peopleNames: string[];
  let filterText = "";
  type SelectItem = { label: string; value: string; isCreator?: boolean };
  let peopleItems: SelectItem[] = [];
  let selectedItem: SelectItem = null;

  let dispatch = createEventDispatcher();

  function nameChanged(newName: string) {
    namesakes = [...stemmaIndex.namesakes(newName).filter((p) => !p.readOnly), { name: newName }];
  }

  export function reset() {
    namesakes = [];
    selectedPerson = null;
    filterText = "";
  }

  $: if (stemma) peopleNames = [...new Set(filterEditablePeople(stemma.people).map((p) => p.name))];
  $: {
    if (!peopleNames) {
      peopleItems = [];
    } else {
      peopleItems = peopleNames.map((name) => ({ label: name, value: name }));
      if (filterText && !peopleNames.includes(filterText)) {
        peopleItems = [
          ...peopleItems,
          { label: $t("family.createOption", { name: filterText }), value: filterText, isCreator: true },
        ];
      }
    }
  }
  $: selectedItem = selectedPerson
    ? { label: selectedPerson.name, value: selectedPerson.name }
    : null;
  $: if (selectedPerson) dispatch("selected", selectedPerson);

  function handleSelect(e) {
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
      >
        <svelte:fragment slot="clear-icon">
          <ClearIcon />
        </svelte:fragment>
      </Select>
    </div>
    <div class="flex-grow-1 mt-2 mb-2" style="min-height:400px">
      <PersonSelector people={namesakes} {stemmaIndex} on:select={(e) => (selectedPerson = e.detail)} />
    </div>
  </div>
</div>
