import { Link } from "waku";

import { Counter } from "../components/counter";
import { rerender, getUserApi } from "../lib/waku/server";

async function toggleTodo(todo: any, path: string) {
   "use server";
   const api = await getUserApi();
   await api.data.updateOne("todos", todo.id, {
      done: !todo.done,
   });
   rerender(path);
}

export default async function HomePage({ path }: any) {
   const api = await getUserApi({ verify: true });
   const todos = await api.data.readMany("todos");
   const user = api.getUser();
   const data = await getData();

   return (
      <div>
         <title>{data.title}</title>
         <h1 className="text-4xl font-bold tracking-tight">{data.headline}</h1>
         <p>{data.body}</p>
         <ul>
            {todos?.map((todo) => (
               <li key={todo.id} className="flex items-center gap-2">
                  {todo.title} {todo.done ? "✅" : "❌"}
                  <form action={toggleTodo.bind(null, todo, path)}>
                     <button type="submit">Toggle</button>
                  </form>
               </li>
            ))}
         </ul>
         <Counter />
         <Link to="/about" className="mt-4 inline-block underline">
            About page
         </Link>
         {user ? (
            <a href="/api/auth/logout" className="mt-4 inline-block underline">
               Logout ({user.email})
            </a>
         ) : (
            <Link to="/login" className="mt-4 inline-block underline">
               Login
            </Link>
         )}
         <Link to="/admin" className="mt-4 inline-block underline">
            Admin
         </Link>
      </div>
   );
}

const getData = async () => {
   const data = {
      title: "Waku",
      headline: "Waku",
      body: "Hello world!",
   };

   return data;
};

export const getConfig = async () => {
   return {
      render: "dynamic",
   } as const;
};
