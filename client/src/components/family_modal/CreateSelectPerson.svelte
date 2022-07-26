<script lang="ts">
  import { NewPerson, Stemma, StoredPerson } from "../../model";
  import { StemmaIndex } from "../../stemmaIndex";
  import Select from "svelte-select";
  import Carousel from "svelte-carousel";
  import VisualPersonDescription from "../misc/VisualPersonDescription.svelte";
  import ClearIcon from "../misc/ClearIconTranslated.svelte";
  import { createEventDispatcher } from "svelte";

  export let stemmaIndex: StemmaIndex;
  export let stemma: Stemma;

  let namesakes: (NewPerson | StoredPerson)[] = [];
  let peopleNames: string[];

  let clearIcon = ClearIcon;
  let carousel;

  let dispatch = createEventDispatcher();
  let selectedName;

  function nameChanged(newName: string) {
    namesakes = [...stemmaIndex.namesakes(newName).filter((p) => !p.readOnly), { name: newName }];
    if (carousel) carousel.goTo(0, { animated: false });
    dispatch("selected", namesakes[0]);
    selectedName = newName;
  }

  export function reset() {
    namesakes = [];
    selectedName = null;
  }

  $: if (stemma) peopleNames = [...new Set(stemma.people.map((p) => p.name))];
</script>

<form>
  {#key namesakes}
    <div class="mb-3">
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
        value={selectedName}
      />
    </div>
    {#if namesakes.length}
      <Carousel on:pageChange={(e) => dispatch("selected", namesakes[e.detail])} bind:this={carousel} duration={0}>
        {#each namesakes as ns, i}
          <div class="d-flex flex-column">
            <VisualPersonDescription selectedPerson={ns} {stemmaIndex} chartId={`ns_chart_${i}`} />
            {#if i == namesakes.length - 1}
              <p class="text-center text-secondary fs-6">Создать нового</p>
            {/if}
          </div>
        {/each}
      </Carousel>
    {:else}
      <div style="height:360px" />
    {/if}
  {/key}
</form>
