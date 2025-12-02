import { useEffect, useState } from "react";
import { useApi, useApiQuery } from "bknd/client";
import { Scrollable } from "ui/layouts/AppShell/AppShell";

function Bla() {
   const api = useApi();

   useEffect(() => {
      (async () => {
         const one = await api.data.readOne("users", 1);
         const many = await api.data.readMany("users");
      })();
   }, []);

   return null;
}

export default function SWRAndAPI() {
   const [text, setText] = useState("");
   const { data, ...r } = useApiQuery((api) => api.data.readOne("comments", 1), {
      refine: (data) => data.data,
      revalidateOnFocus: true,
   });
   const comment = data ? data : null;

   useEffect(() => {
      setText(comment?.content ?? "");
   }, [comment]);

   return (
      <Scrollable>
         <pre>{JSON.stringify(r.key)}</pre>
         {r.error && <div>failed to load</div>}
         {r.isLoading && <div>loading...</div>}
         {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
         {data && (
            <form
               onSubmit={async (e) => {
                  e.preventDefault();
                  if (!comment) return;

                  /*await r.mutate(async () => {
                     const res = await r.api.data.updateOne("comments", comment.id, {
                        content: text
                     });
                     return res.data;
                  });*/

                  return false;
               }}
            >
               <input type="text" value={text} onChange={(e) => setText(e.target.value)} />
               <button type="submit">submit</button>
            </form>
         )}
      </Scrollable>
   );
}
