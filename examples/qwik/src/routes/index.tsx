import { component$ } from "@builder.io/qwik";
import { Form, routeAction$, routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import Footer from "~/components/footer";
import List from "~/components/list";
import { getApi } from "~/lib/bknd";

interface Todo {
   title: string | undefined;
   done: boolean | undefined;
   id: number;
}

export const useGetTodos = routeLoader$(async () => {
   const api = await getApi();
   const limit = 5;
   const todos = await api.data.readMany("todos", { limit, sort: "-id" });
   const total = todos.body.meta.total as number;
   return { total, todos, limit };
});

export const useCompleteTodo = routeAction$(async (data) => {
   const api = await getApi();
   const todo = data as unknown as Todo;  
   await api.data.updateOne("todos", todo.id, {
      done: !todo.done,
   });
});

export const useDeleteTodo = routeAction$(async (data) => {
   const api = await getApi();
   const todo = data as unknown as Todo;
   await api.data.deleteOne("todos", todo.id);
});


export const useAddTodo = routeAction$(async (data) => {
   const api = await getApi();
   await api.data.createOne("todos", { title: data.title as string });
});

export default component$(() => {
   const {
      value: { limit, todos, total },
   } = useGetTodos();
   const addTodoAction = useAddTodo();
   const completeTodoAction = useCompleteTodo();
   const deleteTodoAction = useDeleteTodo();

   return (
      <div class="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
         <main class="flex flex-col gap-8 row-start-2 items-center sm:items-start">
            <div class="flex flex-row items-center justify-evenly min-w-full">
               <img class="size-24" src="/favicon.svg" alt="Qwik logo" width="72" height="72" />
               <div class="ml-3.5 mr-2 font-mono opacity-70">&amp;</div>
               <img class="dark:invert" src="/bknd.svg" alt="bknd logo" width="183" height="59" />
            </div>

            <List
               items={[
                  "Get started with a full backend.",
                  "Focus on what matters instead of repetition.",
               ]}
            />

            <div class="flex flex-col border border-black/15 dark:border-white/15 w-full py-4 px-5 gap-2">
               <h2 class="font-mono mb-1 opacity-70">
                  <code>What's next?</code>
               </h2>
               <div class="flex flex-col w-full gap-2">
                  {total > limit && (
                     <div class="bg-foreground/10 flex justify-center p-1 text-xs rounded text-foreground/40">
                        {total - limit} more todo(s) hidden
                     </div>
                  )}

                  <div class="flex flex-col gap-3">
                     {todos.map((todo) => (
                        <div key={String(todo.id)} class="flex flex-row">
                           <div class="flex flex-row grow items-center gap-3 ml-1">
                              <input
                                 type="checkbox"
                                 class="shrink-0 cursor-pointer"
                                 checked={Boolean(todo.done)}
                                 onChange$={async() => {
                                    await completeTodoAction.submit(todo);
                                 }}
                              />
                              <div class="text-foreground/90 leading-none">{todo.title}</div>
                           </div>
                           <button
                              type="button"
                              class="cursor-pointer grayscale transition-all hover:grayscale-0 text-xs"
                              onclick$={async () => { await deleteTodoAction.submit(todo); }}
                           >
                              ❌
                           </button>
                        </div>
                     ))}
                  </div>

                  <Form
                     class="flex flex-row w-full gap-3 mt-2"
                     key={todos.map((t) => t.id).join()}
                     action={addTodoAction}
                  >
                     <input
                        type="text"
                        name="title"
                        placeholder="New todo"
                        class="py-2 px-4 flex grow rounded-sm bg-black/5 focus:bg-black/10 dark:bg-white/5 dark:focus:bg-white/10 transition-colors outline-none"
                     />
                     <button type="submit" class="cursor-pointer">
                        Add
                     </button>
                  </Form>
               </div>
            </div>
         </main>
        <Footer />
      </div>
   );
});

export const head: DocumentHead = {
   title: "Qwik City 🤝 Bknd.io",
   meta: [
      {
         name: "description",
         content: "Qwik site with bknd",
      },
   ],
};
