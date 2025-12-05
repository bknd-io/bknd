import { useAuth, useEntityQuery } from "bknd/client";
import bkndLogo from "../assets/bknd.svg";
import cloudflareLogo from "../assets/cloudflare.svg";
import viteLogo from "../assets/vite.svg";

export default function Home() {
   const auth = useAuth();

   const limit = 5;
   const { data: todos, ...$q } = useEntityQuery("todos", undefined, {
      limit,
      sort: "-id",
   });

   return (
      <div className="flex-col gap-10 max-w-96 mx-auto w-full min-h-full flex justify-center items-center">
         <div className="flex flex-row items-center gap-3">
            <img src={bkndLogo} alt="bknd" className="w-48 dark:invert" />
            <div className="font-mono opacity-70">&amp;</div>
            <div className="flex flex-row gap-2 items-center">
               <img src={cloudflareLogo} alt="cloudflare" className="h-10" />
               <div className="font-mono opacity-70">+</div>
               <img src={viteLogo} alt="vite" className="w-10" />
            </div>
         </div>

         <div className="flex flex-col border border-foreground/15 w-full py-4 px-5 gap-2">
            <h2 className="font-mono mb-1 opacity-70">
               <code>What's next?</code>
            </h2>
            <div className="flex flex-col w-full gap-2">
               <div className="flex flex-col gap-3">
                  {todos &&
                     [...todos].reverse().map((todo) => (
                        <div className="flex flex-row" key={String(todo.id)}>
                           <div className="flex flex-row flex-grow items-center gap-3 ml-1">
                              <input
                                 type="checkbox"
                                 className="flex-shrink-0 cursor-pointer"
                                 defaultChecked={!!todo.done}
                                 onChange={async () => {
                                    await $q.update(
                                       { done: !todo.done },
                                       todo.id
                                    );
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
                                 await $q._delete(todo.id);
                              }}
                           >
                              ❌
                           </button>
                        </div>
                     ))}
               </div>
               <form
                  className="flex flex-row w-full gap-3 mt-2"
                  key={todos?.map((t) => t.id).join()}
                  action={async (formData: FormData) => {
                     const title = formData.get("title") as string;
                     await $q.create({ title });
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

         <div className="flex flex-col items-center gap-1">
            <a href="/admin">Go to Admin. ➝</a>
            <div className="opacity-50 text-sm">
               {auth.user ? (
                  <p>
                     Authenticated as <b>{auth.user.email}</b>
                  </p>
               ) : (
                  <a href="/admin/auth/login">Login</a>
               )}
            </div>
         </div>
      </div>
   );
}
