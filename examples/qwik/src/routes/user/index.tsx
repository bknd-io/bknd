import { component$ } from "@builder.io/qwik";
import { Link, routeLoader$ } from "@builder.io/qwik-city";
import List from "~/components/list";
import { getApi } from "~/lib/bknd";
import Footer from "~/components/footer";

export const useGetTodos = routeLoader$(async ({ request }) => {
   const api = await getApi({ verify: true, headers: request.headers });
   const limit = 5;
   const todos = await api.data.readMany("todos", { limit, sort: "-id" });
   const total = todos.body.meta.total as number;
   const user = api.getUser();
   return { total, todos, limit, user };
});

export default component$(() => {
   const {
      value: { todos, user },
   } = useGetTodos();

   return (
      <div class="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
         <main class="flex flex-col gap-8 row-start-2 items-center sm:items-start">
            <div class="flex flex-row items-center ">
               <img
                  class="dark:invert size-18"
                  src="/favicon.svg"
                  alt="Qwik logo"
                  height={72}
                  width={72}
               />
               <div class="ml-3.5 mr-2 font-mono opacity-70">&amp;</div>
               <img class="dark:invert" src="/bknd.svg" alt="bknd logo" width={183} height={59} />
            </div>
            <List items={todos.map((todo) => todo.title ?? "")} />
            <Buttons />

            <div>
               {user ? (
                  <>
                     Logged in as {user.email}.
                     <Link class="font-medium underline" href={"/api/auth/logout" as string}>
                        Logout
                     </Link>
                  </>
               ) : (
                  <div class="flex flex-col gap-1">
                     <p>
                        Not logged in.
                        <Link class="font-medium underline" href={"/admin/auth/login" as string}>
                           Login
                        </Link>
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
         </main>
         <Footer />
      </div>
   );
});

function Buttons() {
   return (
      <div class="flex gap-4 items-center flex-col sm:flex-row">
         <a
            class="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground gap-2 text-white hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
            href="https://bknd.io/"
            target="_blank"
            rel="noopener noreferrer"
         >
            <img class="grayscale" src="/bknd.ico" alt="bknd logomark" width={20} height={20} />
            Go To Bknd.io
         </a>
         <a
            class="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
            href="https://docs.bknd.io/integration/meta-framework"
            target="_blank"
            rel="noopener noreferrer"
         >
            Read our docs
         </a>
      </div>
   );
}
