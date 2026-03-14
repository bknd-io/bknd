import { getApi } from "@/bknd";
import { createServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import { Footer } from "@/components/Footer";
import { List } from "@/components/List";

export const getTodo = createServerFn({ method: "POST" }).handler(async () => {
  const api = await getApi({});
  const limit = 5;
  const todos = await api.data.readMany("todos");
  const total = todos.body.meta.total as number;
  return { total, todos, limit };
});

export const getUser = createServerFn({ method: "POST" }).handler(async () => {
  const request = getRequest();
  const api = await getApi({ verify: true, headers: request.headers });
  const user = api.getUser();
  return { user };
});

export const Route = createFileRoute("/ssr")({
  component: RouteComponent,
  loader: async () => {
    return { ...(await getTodo()), ...(await getUser()) };
  },
});

function RouteComponent() {
  const { todos, user } = Route.useLoaderData();

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
        <List items={todos.map((todo) => todo.title)} />
        <Buttons />

        <div>
          {user ? (
            <>
              Logged in as {user.email}.{" "}
              <Link
                className="font-medium underline"
                to={"/api/auth/logout" as string}
              >
                Logout
              </Link>
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <p>
                Not logged in.{" "}
                <Link
                  className="font-medium underline"
                  to={"/admin/auth/login" as string}
                >
                  Login
                </Link>
              </p>
              <p className="text-xs opacity-50">
                Sign in with:{" "}
                <b>
                  <code>test@bknd.io</code>
                </b>{" "}
                /{" "}
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
}

function Buttons() {
  return (
    <div className="flex gap-4 items-center flex-col sm:flex-row">
      <a
        className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground gap-2 text-white hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
        href="https://bknd.io/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          className="grayscale"
          src="/bknd.ico"
          alt="bknd logomark"
          width={20}
          height={20}
        />
        Go To Bknd.io
      </a>
      <a
        className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
        href="https://docs.bknd.io/integration/tanstack-start"
        target="_blank"
        rel="noopener noreferrer"
      >
        Read our docs
      </a>
    </div>
  );
}
