<script lang="ts" context="module">
    export type Graph = {
        name: string;
        id: string;
    };
</script>

<script lang="ts">
    import Select, { Option } from "../../node_modules/@smui/select";

    let fruits = ['Apple', 'Orange', 'Banana', 'Mango'];
 
 let value = 'Orange';
</script>

<div class="columns margins" style="justify-content: flex-start;">
    <div>
        <Select bind:value label="Select Menu">
          {#each fruits as fruit}
            <Option value={fruit}>{fruit}</Option>
          {/each}
        </Select>
     
        <pre class="status">Selected: {value}</pre>
      </div>
</div>
