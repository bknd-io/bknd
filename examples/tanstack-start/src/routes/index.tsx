import {
  createFileRoute,
  useRouter,
} from "@tanstack/react-router";
import { getApi } from "@/bknd";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { Footer } from "@/components/Footer";
import { List } from "@/components/List";

export const completeTodo = createServerFn({ method: "POST" })
  .inputValidator(
    (data) => data as { done: boolean; id: number; title: string },
  )
  .handler(async ({ data: todo }) => {
    try {
      const api = await getApi({});
      await api.data.updateOne("todos", todo.id, {
        done: !todo.done,
      });
      console.log("state updated in db");
    } catch (error) {
      console.log(error);
    }
  });

export const deleteTodo = createServerFn({ method: "POST" })
  .inputValidator((data) => data as { id: number })
  .handler(async ({ data }) => {
    try {
      const api = await getApi({});
      await api.data.deleteOne("todos", data.id);
      console.log("todo deleted from db");
    } catch (error) {
      console.log(error);
    }
  });

export const createTodo = createServerFn({ method: "POST" })
  .inputValidator((data) => data as { title: string })
  .handler(async ({ data }) => {
    try {
      const api = await getApi({});
      await api.data.createOne("todos", { title: data.title });
      console.log("todo created in db");
    } catch (error) {
      console.log(error);
    }
  });

export const getTodo = createServerFn({ method: "POST" }).handler(async () => {
  const api = await getApi({});
  const limit = 5;
  const todos = await api.data.readMany("todos", { limit, sort: "-id" });
  const total = todos.body.meta.total as number;
  return { total, todos, limit };
});

export const Route = createFileRoute("/")({
  ssr:false,
  component: App,
  loader: async () => {
    return await getTodo();
  },
});

function App() {
  const { todos, total, limit } = Route.useLoaderData();
  const router = useRouter();

  const updateTodo = useServerFn(completeTodo);
  const removeTodo = useServerFn(deleteTodo);
  const addTodo = useServerFn(createTodo);

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <div className="flex flex-row items-center ">
          <img
            className="dark:invert size-18"
            src="/tanstack-circle-logo.png"
            alt="TanStack logo"
          />
          <div className="ml-3.5 mr-2 font-mono opacity-70">&amp;</div>
          <img
            className="dark:invert"
            src="/bknd.svg"
            alt="bknd logo"
            width={183}
            height={59}
          />
        </div>
        <Description />
        <div className="flex flex-col border border-foreground/15 w-full py-4 px-5 gap-2">
          <h2 className="font-mono mb-1 opacity-70">
            <code>What's next?</code>
          </h2>
          <div className="flex flex-col w-full gap-2">
            {total > limit && (
              <div className="bg-foreground/10 flex justify-center p-1 text-xs rounded text-foreground/40">
                {total - limit} more todo(s) hidden
              </div>
            )}
            <div className="flex flex-col gap-3">
              {todos.map((todo) => (
                <div className="flex flex-row" key={String(todo.id)}>
                  <div className="flex flex-row flex-grow items-center gap-3 ml-1">
                    <input
                      type="checkbox"
                      className="flex-shrink-0 cursor-pointer"
                      defaultChecked={!!todo.done}
                      onChange={async () => {
                        await updateTodo({ data: todo });
                        router.invalidate();
                      }}
                    />
                    <div className="text-foreground/90 leading-none">
                      {todo.title}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="cursor-pointer grayscale transition-all hover:grayscale-0 text-xs "
                    onClick={async () => {
                      await removeTodo({ data: { id: todo.id } });
                      router.invalidate();
                    }}
                  >
                    ❌
                  </button>
                </div>
              ))}
            </div>
            <form
              className="flex flex-row w-full gap-3 mt-2"
              key={todos.map((t) => t.id).join()}
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const title = formData.get("title") as string;
                await addTodo({ data: { title } });
                router.invalidate();
                e.currentTarget.reset();
              }}
            >
              <input
                type="text"
                name="title"
                placeholder="New todo"
                className="py-2 px-4 flex flex-grow rounded-sm bg-foreground/10 focus:bg-foreground/20 transition-colors outline-none"
              />
              <button type="submit" className="cursor-pointer">
                Add
              </button>
            </form>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

const Description = () => (
  <List
    items={[
      "Get started with a full backend.",
      "Focus on what matters instead of repetition.",
    ]}
  />
);

