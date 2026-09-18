<script lang="ts" setup>

const { fetchTodos, toggleTodo, createTodo, deleteTodo } = useTodoActions();
const { data: todos, refresh } = await useAsyncData('todos', () => fetchTodos());

async function handleSubmit(event: Event) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  if (!form) return;

  const formData = new FormData(form);
  const title = formData.get("title");
  await createTodo(title as string);

  refresh();
};

</script>

<template>
  <div v-if="todos !== undefined"
    class="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
    <main class="flex flex-col gap-8 row-start-2 items-center sm:items-start">
      <div class="flex flex-row items-center justify-evenly min-w-full">
        <img class="size-24" src="/nuxt.svg" alt="Nuxt logo" />
        <div class="ml-3.5 mr-2 font-mono opacity-70">&amp;</div>
        <img class="dark:invert" src="/bknd.svg" alt="bknd logo" width="183" height="59" />
      </div>

      <List :items="['Get started with a full backend.', 'Focus on what matters instead of repetition.']" />

      <div class="flex flex-col border border-black/15 dark:border-white/15 w-full py-4 px-5 gap-2">
        <h2 class="font-mono mb-1 opacity-70"><code>What's next?</code></h2>
        <div class="flex flex-col w-full gap-2">
          <div v-if="todos.total > todos.limit"
            class="bg-foreground/10 flex justify-center p-1 text-xs rounded text-foreground/40">
            {{ todos.total - todos.limit }} more todo(s) hidden
          </div>

          <div class="flex flex-col gap-3">
            <div v-for="todo in todos.todos" :key="String(todo.id)" class="flex flex-row">
              <div class="flex flex-row flex-grow items-center gap-3 ml-1">
                <input
                  type="checkbox" 
                  class="flex-shrink-0 cursor-pointer" 
                  :checked="Boolean(todo.done)"
                  @change="() => { toggleTodo(todo); refresh() }" />
                <div class="text-foreground/90 leading-none">{{ todo.title }}</div>
              </div>
              <button type="button" class="cursor-pointer grayscale transition-all hover:grayscale-0 text-xs"
                @click="async () => { await deleteTodo(todo); refresh() }">
                ❌
              </button>
            </div>
          </div>

          <form class="flex flex-row w-full gap-3 mt-2" :key="todos.todos.map(t => t.id).join()" @submit="handleSubmit">
            <input 
              type="text" 
              name="title" 
              placeholder="New todo"
              class="py-2 px-4 flex flex-grow rounded-sm bg-black/5 focus:bg-black/10 dark:bg-white/5 dark:focus:bg-white/10 transition-colors outline-none" />
            <button type="submit" class="cursor-pointer">Add</button>
          </form>
        </div>
      </div>
    </main>
    <Footer />
  </div>
</template>
