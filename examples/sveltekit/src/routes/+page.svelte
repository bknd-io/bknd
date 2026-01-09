<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<h1>bknd + SvelteKit Example</h1>

<h2>Todos</h2>
<ul>
  {#each data.todos as todo (todo.id)}
    <li>{todo.title} - {todo.done === "true" ? "Done" : "Pending"}</li>
  {/each}
</ul>

<h2>API Endpoints</h2>
<ul>
  <li><a href="/api/data/entity/todos">/api/data/entity/todos</a></li>
  <li><a href="/api/auth/password/login">/api/auth/password/login</a> (POST)</li>
</ul>

<p>
  Login credentials: <code>admin@example.com</code> / <code>password</code>
</p>
