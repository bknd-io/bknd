import { useEffect, useState } from "react";
import { useEntity, useEntityMutate, useEntityQuery } from "ui/client/api/use-entity";
import { Scrollable } from "ui/layouts/AppShell/AppShell";

export default function SwrAndDataApi() {
   return (
      <Scrollable>
         asdf
         <DirectDataApi />
         <QueryDataApi />
         <QueryMutateDataApi />
      </Scrollable>
   );
}

function QueryMutateDataApi() {
   const { mutate } = useEntityMutate("comments");
   const { data, ...r } = useEntityQuery("comments", undefined, {
      limit: 2,
   });

   return (
      <div>
         bla
         <pre>{JSON.stringify(r.key)}</pre>
         {r.error && <div>failed to load</div>}
         {r.isLoading && <div>loading...</div>}
         {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
         {data && (
            <div>
               {data.map((comment) => (
                  <input
                     key={String(comment.id)}
                     type="text"
                     value={comment.content}
                     onChange={async (e) => {
                        await mutate(comment.id, { content: e.target.value });
                     }}
                     className="border border-black"
                  />
               ))}
            </div>
         )}
      </div>
   );
}

function QueryMutateDataApi2() {
   const { mutate } = useEntityMutate("users");
   const { data, ...r } = useEntityQuery("users", undefined, {
      limit: 2,
   });

   return (
      <div>
         bla
         <pre>{JSON.stringify(r.key)}</pre>
         {r.error && <div>failed to load</div>}
         {r.isLoading && <div>loading...</div>}
         {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
         {data && (
            <div>
               {data.map((user) => (
                  <input
                     key={String(user.id)}
                     type="text"
                     value={user.email}
                     onChange={async (e) => {
                        await mutate(user.id, { email: e.target.value });
                     }}
                     className="border border-black"
                  />
               ))}
            </div>
         )}
      </div>
   );
}

function QueryDataApi() {
   const { data, update, ...r } = useEntityQuery("users", undefined, {
      sort: { by: "id", dir: "asc" },
      limit: 3,
   });

   return (
      <div>
         <pre>{JSON.stringify(r.key)}</pre>
         {r.error && <div>failed to load</div>}
         {r.isLoading && <div>loading...</div>}
         {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
      </div>
   );
}

function DirectDataApi() {
   const [data, setData] = useState<any>();
   const { create, read, update, _delete } = useEntity("comments");

   useEffect(() => {
      read().then((data) => setData(data));
   }, []);

   return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
