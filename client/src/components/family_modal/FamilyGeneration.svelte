<script lang="ts">
  import { CreateNewPerson, PersonDescription } from "../../model";

  export let selectedPeople: (PersonDescription | CreateNewPerson)[] = [];
  export let readOnly: boolean;

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
          <th class="align-middle" scope="row">{i + 1}</th>
          <td class="align-middle">{p.name}</td>
          <td class="align-middle">
            {#if !readOnly}
              <div class="float-end">
                <button type="button" class="btn btn-sm btn-danger" on:click={(e) => remove(i)}><i class="bi bi-trash" /></button>
              </div>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
