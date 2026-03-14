import { useRouterState, Link } from "@tanstack/react-router";

export function Footer() {
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  return (
    <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
      <Link
        className="flex items-center gap-2 hover:underline hover:underline-offset-4"
        to={pathname === "/" ? "/ssr" : ("/" as string)}
      >
        <img
          aria-hidden
          src="/file.svg"
          alt="File icon"
          width={16}
          height={16}
        />
        {pathname === "/" ? "SSR" : "Home"}
      </Link>
      <Link
        className="flex items-center gap-2 hover:underline hover:underline-offset-4"
        to={"/admin" as string}
      >
        <img
          aria-hidden
          src="/window.svg"
          alt="Window icon"
          width={16}
          height={16}
        />
        Admin
      </Link>
      <Link
        className="flex items-center gap-2 hover:underline hover:underline-offset-4"
        to={"https://bknd.io" as string}
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          aria-hidden
          src="/globe.svg"
          alt="Globe icon"
          width={16}
          height={16}
        />
        Go to bknd.io →
      </Link>
    </footer>
  );
}
