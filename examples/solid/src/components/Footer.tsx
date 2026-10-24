import { A, useLocation } from "@solidjs/router";

export function Footer() {
  const pathname = useLocation().pathname;

  return (
    <footer class="row-start-3 flex gap-6 flex-wrap items-center justify-center">
      <A
        class="flex items-center gap-2 hover:underline hover:underline-offset-4"
        href={pathname === "/" ? "/user" : "/"}
      >
        <img
          aria-hidden
          src="/file.svg"
          alt="File icon"
          width={16}
          height={16}
        />
        {pathname === "/" ? "User" : "Home"}
      </A>
      <A
        target="_self"
        class="flex items-center gap-2 hover:underline hover:underline-offset-4"
        href="/admin"
        rel="noopener noreferrer"
      >
        <img
          aria-hidden
          src="/window.svg"
          alt="Window icon"
          width={16}
          height={16}
        />
        Admin
      </A>
      <a
        class="flex items-center gap-2 hover:underline hover:underline-offset-4"
        href={"https://bknd.io"}
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
      </a>
    </footer>
  );
}
