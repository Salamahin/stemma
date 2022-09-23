<script lang="ts">
  import { Stemma, CreateNewPerson, PersonDescription } from "../../model";
  import { StemmaIndex } from "../../stemmaIndex";
  import Select from "svelte-select";
  import ClearIcon from "../misc/ClearIconTranslated.svelte";
  import { createEventDispatcher } from "svelte";
  import PersonSelector from "../misc/PersonSelector.svelte";

  export let stemmaIndex: StemmaIndex;
  export let stemma: Stemma;

  let clearIcon = ClearIcon;

  let namesakes: (CreateNewPerson | PersonDescription)[] = [];
  let selectedPerson: CreateNewPerson | PersonDescription;
  let peopleNames: string[];

  let dispatch = createEventDispatcher();

  function nameChanged(newName: string) {
    namesakes = [...stemmaIndex.namesakes(newName).filter((p) => !p.readOnly), { name: newName }];
  }

  export function reset() {
    namesakes = [];
    selectedPerson = null;
  }

  $: if (stemma) peopleNames = [...new Set(stemma.people.map((p) => p.name))];
  $: if (selectedPerson) dispatch("selected", selectedPerson);
</script>

<div class="container h-100">
  <div class="d-flex flex-column h-100">
    <div class="flex-shrink-1">
      <label for="personName" class="form-label">Полное имя</label>
      <Select
        id="personName"
        placeholder="Иванов Иван Иванович"
        items={peopleNames}
        isSearchable={true}
        isCreatable={true}
        on:select={(e) => nameChanged(e.detail.value)}
        on:clear={() => reset()}
        ClearIcon={clearIcon}
        getOptionLabel={(option, filterText) => {
          return option.isCreator ? `Создать "${filterText}"` : option["label"];
        }}
        hideEmptyState={true}
        value={selectedPerson ? selectedPerson.name : null}
      />
    </div>
    <div class="flex-grow-1 mt-2 mb-2" style="min-height:400px">
      <PersonSelector people={namesakes} {stemmaIndex} on:select={(e) => (selectedPerson = e.detail)} />
    </div>
  </div>
</div>
