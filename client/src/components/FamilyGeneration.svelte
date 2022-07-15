<script lang="ts">
  import { NewPerson, Stemma, StoredPerson } from "../model";
  import { StemmaIndex } from "../stemmaIndex";
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  export let stemma: Stemma;
  export let stemmaIndex: StemmaIndex;
  export let maxPeople: number;
  export let selectedPeople: (StoredPerson | NewPerson)[] = [];

  function remove(index: number) {
    selectedPeople = selectedPeople.splice(index, 1);
  }
</script>

{#if !selectedPeople.length}
<p class="text-center text-secondary fs-6 fw-bolder">Нет информации</p>
{:else}
<table class="table table-striped">
  <tbody>
    {#each selectedPeople as p, i}
      <tr>
        <th class="align-middle text-end" scope="row">{i + 1}</th>
        <td class="align-middle">{p.name}</td>
        <td class="align-middle">
          <div class="float-end">
            <button type="button" class="btn btn-sm btn-danger" on:click={(e) => remove(i)}><i class="bi bi-trash3-fill" /></button>
          </div>
        </td>
      </tr>
    {/each}
  </tbody>
</table>
{/if}

<div class="float-end">
  {#if selectedPeople.length < maxPeople}
    <button type="button" class="btn btn-primary btn-sm" on:click={(e) => dispatch("create")}><i class="bi bi-person-plus-fill"></i></button>
  {/if}
</div>
