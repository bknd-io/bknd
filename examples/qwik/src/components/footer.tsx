import { Link } from "@builder.io/qwik-city";
import { component$ } from "@builder.io/qwik";
import { useLocation } from "@builder.io/qwik-city";

export default component$(() => {
   const loc = useLocation();
   return (
      <footer class="row-start-3 flex gap-6 flex-wrap items-center justify-center">
         <Link
            class="flex items-center gap-2 hover:underline hover:underline-offset-4"
            href={loc.url.pathname === '/' ? '/user' : '/'}
         >
            <img aria-hidden src="/file.svg" alt="File icon" width="16" height="16" />
            {loc.url.pathname === "/" ? "User" : "Home"}
         </Link>

         <Link
            class="flex items-center gap-2 hover:underline hover:underline-offset-4"
            href="/admin/data"
         >
            <img aria-hidden src="/window.svg" alt="Window icon" width="16" height="16" />
            Admin
         </Link>

         <a
            class="flex items-center gap-2 hover:underline hover:underline-offset-4"
            href="https://bknd.io"
            target="_blank"
            rel="noopener noreferrer"
         >
            <img aria-hidden src="/globe.svg" alt="Globe icon" width="16" height="16" />
            Go to bknd.io →
         </a>
      </footer>
   );
});
