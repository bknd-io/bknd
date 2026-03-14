import { A } from "@solidjs/router";
import type { DB } from "bknd";
import { createResource, Suspense } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import { Footer } from "~/components/Footer";
import { List } from "~/components/List";
import { getApi } from "~/lib/bknd";


const getUser = async () => {
  "use server"
  const request = getRequestEvent()?.request;
  const api = await getApi({ verify: true, headers: request?.headers });
  return api.getUser();
}

type Todo = DB['todos'];
export const getTodo = async () => {
  "use server"
  const api = await getApi({});
  const limit = 5;
  const todos = await api.data.readMany("todos");
  const total = todos.body.meta.total as number;
  return { total, todos: todos as unknown as Todo[], limit };
};

export default function Home() {
  const [data] = createResource(async () => {
    const todo = await getTodo();
    const user = await getUser()
    return { todo, user };
  }, {
    initialValue: {
      todo: {
        todos: [],
        limit: 0,
        total: 0
      },
      user: null
    }
  });

  return (
    <div class="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main class="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <div class="flex flex-row items-center ">
          <img
            class="dark:invert size-18"
            src="/solid.svg"
            alt="Solid logo"
          />
          <div class="ml-3.5 mr-2 opacity-70">&amp;</div>
          <img
            class="dark:invert"
            src="/bknd.svg"
            alt="bknd logo"
            width={183}
            height={59}
          />
        </div>
        <List items={(data()?.todo.todos ?? []).map((todo) => todo.title)} />
        <Buttons />

        <Suspense fallback={<p>Loading...</p>}>
          <div>
            {data()?.user ? (
              <>
                Logged in as {data()?.user?.email}.
                <A
                  class="underline"
                  // target="_self" is required to prevent solid router from intercepting the link
                  target="_self"
                  href={"/api/auth/logout"}
                >
                  Logout
                </A>
              </>
            ) : (
              <div class="flex flex-col gap-1">
                <p>
                  Not logged in.
                  <A
                    class="underline"
                    // target="_self" is required to prevent solid router from intercepting the link
                    target="_self"
                    href={"/admin/auth/login"}
                  >
                    Login
                  </A>
                </p>
                <p class="text-xs opacity-50">
                  Sign in with:
                  <b>
                    <code>test@bknd.io</code>
                  </b>
                  /
                  <b>
                    <code>12345678</code>
                  </b>
                </p>
              </div>
            )}
          </div>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

function Buttons() {
  return (
    <div class="flex gap-4 items-center flex-col sm:flex-row">
      <a
        class="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground gap-2 text-white hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
        href="https://bknd.io/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          class="grayscale"
          src="/bknd.ico"
          alt="bknd logomark"
          width={20}
          height={20}
        />
        Go To Bknd.io
      </a>
      <a
        class="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
        href="https://docs.bknd.io/start"
        target="_blank"
        rel="noopener noreferrer"
      >
        Read our docs
      </a>
    </div>
  );
}
