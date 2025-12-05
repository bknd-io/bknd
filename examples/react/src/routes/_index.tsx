import { Center } from "~/components/Center";
import { useEntityQuery } from "bknd/client";
import type { SQLocalConnection } from "bknd";
import { useApp } from "bknd/adapter/browser";
import { useEffect, useState } from "react";
import { Link } from "wouter";

export default function IndexPage() {
   //const user = app.getApi().getUser();
   const limit = 5;
   const { data: todos, ...$q } = useEntityQuery("todos", undefined, {
      limit,
      sort: "-id",
   });
   // @ts-ignore
   const total = todos?.body.meta.total || 0;

   return (
      <Center className="flex-col gap-10 max-w-96 mx-auto">
         <div className="flex flex-col gap-2 items-center">
            <img src="/bknd.svg" alt="bknd" className="w-48 dark:invert" />
            <p className="font-mono">local</p>
         </div>

         <div className="flex flex-col border border-foreground/15 w-full py-4 px-5 gap-2">
            <h2 className="font-mono mb-1 opacity-70">
               <code>What's next? ({total})</code>
            </h2>
            <div className="flex flex-col w-full gap-2">
               {total > limit && (
                  <div className="bg-foreground/10 flex justify-center p-1 text-xs rounded text-foreground/40">
                     {total - limit} more todo(s) hidden
                  </div>
               )}
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
                                    await $q.update({ done: !todo.done }, todo.id);
                                 }}
                              />
                              <div className="text-foreground/90 leading-none">{todo.title}</div>
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
            <Link to="/admin">Go to Admin ➝</Link>
            {/*<div className="opacity-50 text-sm">
                  {user ? (
                     <p>
                        Authenticated as <b>{user.email}</b>
                     </p>
                  ) : (
                     <a href="/admin/auth/login">Login</a>
                  )}
               </div>*/}
         </div>
         <Debug />
      </Center>
   );
}

function Debug() {
   const { app } = useApp();
   const [info, setInfo] = useState<any>();
   const connection = app.em.connection as SQLocalConnection;

   useEffect(() => {
      (async () => {
         setInfo(await connection.client.getDatabaseInfo());
         app.emgr.onAny(
            async () => {
               setInfo(await connection.client.getDatabaseInfo());
            },
            { mode: "sync", id: "debug" },
         );
      })();
   }, []);

   async function download() {
      const databaseFile = await connection.client.getDatabaseFile();
      const fileUrl = URL.createObjectURL(databaseFile);

      const a = document.createElement("a");
      a.href = fileUrl;
      a.download = "database.sqlite3";
      a.click();
      a.remove();

      URL.revokeObjectURL(fileUrl);
   }

   return (
      <div className="flex flex-col gap-2 items-center">
         <button
            type="button"
            className="bg-foreground/20 leading-none py-2 px-3.5 rounded-lg text-sm hover:bg-foreground/30 transition-colors cursor-pointer"
            onClick={download}
         >
            Download Database
         </button>
         <pre className="text-xs">{JSON.stringify(info, null, 2)}</pre>
      </div>
   );
}
