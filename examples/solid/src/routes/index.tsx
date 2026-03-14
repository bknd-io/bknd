import type { DB } from "bknd";
import { Suspense } from "solid-js";
import { Footer } from "~/components/Footer";
import { List } from "~/components/List";
import { getApi } from "~/lib/bknd";
import { action, redirect, useAction, useSubmission } from "@solidjs/router";
import { query, createAsync } from "@solidjs/router";

type Todo = DB['todos'];

export const getTodo = async () => {
  "use server"
  const api = await getApi({});
  const limit = 5;
  const todos = await api.data.readMany("todos");
  const total = todos.body.meta.total as number;
  return { total, todos: todos as unknown as Todo[], limit };
};

const getTodosFromServer = query(async () => await getTodo(), "getTodosFromServer");


const createTodo = action(async (formData: FormData) => {
  "use server"
  const title = formData.get("title") as string;
  const api = await getApi({});
  await api.data.createOne("todos", { title });
  throw redirect("/", { revalidate: getTodosFromServer.keyFor() });
}, "createTodo");



const completeTodo = action(async (todo: Todo) => {
  "use server"
  const api = await getApi({});
  await api.data.updateOne("todos", todo.id, {
    done: !todo.done,
  });
  throw redirect("/", { revalidate: getTodosFromServer.keyFor() });
}, "completeTodo");


const deleteTodo = action(async (todo: Todo) => {
  "use server"
  const api = await getApi({});
  await api.data.deleteOne("todos", todo.id);
  throw redirect("/", { revalidate: getTodosFromServer.keyFor() });
}, "deleteTodo");

export default function Home() {
  const data = createAsync(() => getTodosFromServer());

  const submission = useSubmission(createTodo);

  const updateTodo = useAction(completeTodo);
  const removeTodo = useAction(deleteTodo);

  return (
    <div class="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 ">
      <main class="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <div class="flex flex-row items-center ">
          <img
            class="dark:invert size-18"
            src="/solid.svg"
            alt="Solid Start logo"
          />
          <div class="ml-3.5 mr-2  opacity-70">&amp;</div>
          <img
            class="dark:invert"
            src="/bknd.svg"
            alt="bknd logo"
            width={183}
            height={59}
          />
        </div>
        <Description />
        <Suspense>
          <div class="flex flex-col border border-foreground/15 w-full py-4 px-5 gap-2">
            <h2 class=" mb-1 opacity-70">
              <code>What's next?</code>
            </h2>
            <div class="flex flex-col w-full gap-2">
              {(data()?.total ?? 0) > (data()?.limit ?? 0) && (
                <div class="bg-foreground/10 flex justify-center p-1 text-xs rounded text-foreground/40">
                  {(data()?.total ?? 0) - (data()?.limit ?? 0)} more todo(s) hidden
                </div>
              )}
              <div class="flex flex-col gap-3">
                {data()?.todos?.
                  splice(0, data()?.limit ?? 0)
                  .map((todo) => (
                    <div class="flex flex-row">
                      <div class="flex flex-row flex-grow items-center gap-3 ml-1">
                        <input
                          type="checkbox"
                          class="flex-shrink-0 cursor-pointer"
                          checked={!!todo.done}
                          onChange={async () => {
                            await updateTodo(todo);
                          }}
                        />
                        <div class="text-foreground/90 leading-none">
                          {todo.title}
                        </div>
                      </div>
                      <button
                        type="button"
                        class="cursor-pointer grayscale transition-all hover:grayscale-0 text-xs "
                        onClick={async () => {
                          await removeTodo(todo);
                        }}
                      >
                        ❌
                      </button>
                    </div>
                  ))}
              </div>
              <form
                class="flex flex-row w-full gap-3 mt-2"
                action={createTodo}
                method="post"
              >
                <input
                  type="text"
                  name="title"
                  placeholder="New todo"
                  class="py-2 px-4 flex flex-grow rounded-sm bg-foreground/10 focus:bg-foreground/20 transition-colors outline-none"
                />
                <button type="submit" class="cursor-pointer" disabled={submission.pending}>
                  {submission.pending ? "Adding..." : "Add"}
                </button>
              </form>
            </div>
          </div>
        </Suspense>
      </main>
      <Footer />
    </div>);
}



const Description = () => (
  <List
    items={[
      "Get started with a full backend.",
      "Focus on what matters instead of repetition.",
    ]}
  />
);