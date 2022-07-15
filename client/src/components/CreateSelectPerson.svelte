<script lang="ts">
  import { NewPerson, Stemma, StoredPerson } from "../model";
  import { StemmaIndex } from "../stemmaIndex";
  import Select from "svelte-select";
  import VisualPersonDescription from "./VisualPersonDescription.svelte";
  export let stemmaIndex: StemmaIndex;

  export let stemma: Stemma;

  let namesakes: (NewPerson | StoredPerson)[] = [];
  let peopleNames: string[];

  function nameChanged(newName: string) {
    namesakes = [{ name: newName }, ...stemmaIndex.namesakes(newName)];
  }

  $: if (stemma) peopleNames = [...new Set(stemma.people.map((p) => p.name))];
</script>

<form>
  <div class="mb-3">
    <label for="personName" class="form-label">Полное имя</label>
    <Select id="personName" items={peopleNames} isSearchable={true} isCreatable={true} on:select={(e) => nameChanged(e.detail.value)} />
  </div>
  {#if namesakes.length}
    <div id="namesakeCarousel" class="carousel carousel-dark slide" data-bs-ride="carousel">
      <div class="carousel-indicators">
        {#each namesakes as ns, i}
          <button type="button" data-bs-target="#namesakeCarousel" data-bs-slide-to={i} class={i == 0 ? "active" : null} aria-current={i == 0} />
        {/each}
      </div>
      <div class="carousel-inner">
        {#each namesakes as ns, i}
          <div class="carousel-item {i == 0 ? 'active' : ''}" data-bs-interval="false">
            <VisualPersonDescription selectedPerson={ns} {stemmaIndex} chartId={`ns_chart_${i}`} />
            <div class="carousel-caption d-none d-md-block">
              {#if i == 0}
                <p>Создать нового</p>
              {/if}
            </div>
          </div>
        {/each}
      </div>
      <button class="carousel-control-prev" type="button" data-bs-target="#namesakeCarousel" data-bs-slide="prev">
        <span class="carousel-control-prev-icon" aria-hidden="true" />
        <span class="visually-hidden">Previous</span>
      </button>
      <button class="carousel-control-next" type="button" data-bs-target="#namesakeCarousel" data-bs-slide="next">
        <span class="carousel-control-next-icon" aria-hidden="true" />
        <span class="visually-hidden">Next</span>
      </button>
    </div>
  {/if}
</form>
