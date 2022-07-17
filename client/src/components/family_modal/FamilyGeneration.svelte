<script lang="ts">
  import { NewPerson, StoredPerson } from "../../model";

  export let selectedPeople: (StoredPerson | NewPerson)[] = [];

  function remove(index: number) {
    selectedPeople = selectedPeople.filter((element, i) => i != index);
  }
</script>

{#if !selectedPeople.length}
  <p class="text-center text-secondary fs-6">Нет информации</p>
{:else}
  <table class="table">
    <tbody>
      {#each selectedPeople as p, i}
        <tr>
          <th class="align-middle text-end" scope="row">{i + 1}</th>
          <td class="align-middle">{p.name}</td>
          <td class="align-middle">
            <div class="float-end">
              <button type="button" class="btn btn-sm btn-danger" on:click={(e) => remove(i)}><i class="bi bi-trash" /></button>
            </div>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
