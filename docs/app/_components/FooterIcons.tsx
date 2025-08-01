import { ThemeToggle } from "fumadocs-ui/components/layout/theme-toggle";

export function FooterIcons() {
  return (
    <div className="flex justify-between items-center w-full px-2">
      <div className="flex items-center gap-3">
        <a
          href="https://github.com/bknd-io/bknd"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          className="text-fd-muted-foreground hover:text-fd-accent-foreground"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6"
            viewBox="0 0 24 24"
          >
            <path
              fill="currentColor"
              d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2"
            ></path>
          </svg>
        </a>
        <a
          href="https://discord.gg/952SFk8Tb8"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Discord"
          className="text-fd-muted-foreground hover:text-fd-accent-foreground"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6.5 h-6.5"
            viewBox="0 0 24 24"
          >
            <path
              fill="currentColor"
              d="M18.942 5.556a16.3 16.3 0 0 0-4.126-1.3a12 12 0 0 0-.529 1.1a15.2 15.2 0 0 0-4.573 0a12 12 0 0 0-.535-1.1a16.3 16.3 0 0 0-4.129 1.3a17.4 17.4 0 0 0-2.868 11.662a15.8 15.8 0 0 0 4.963 2.521q.616-.847 1.084-1.785a10.6 10.6 0 0 1-1.706-.83q.215-.16.418-.331a11.66 11.66 0 0 0 10.118 0q.206.172.418.331q-.817.492-1.71.832a12.6 12.6 0 0 0 1.084 1.785a16.5 16.5 0 0 0 5.064-2.595a17.3 17.3 0 0 0-2.973-11.59M8.678 14.813a1.94 1.94 0 0 1-1.8-2.045a1.93 1.93 0 0 1 1.8-2.047a1.92 1.92 0 0 1 1.8 2.047a1.93 1.93 0 0 1-1.8 2.045m6.644 0a1.94 1.94 0 0 1-1.8-2.045a1.93 1.93 0 0 1 1.8-2.047a1.92 1.92 0 0 1 1.8 2.047a1.93 1.93 0 0 1-1.8 2.045"
            ></path>
          </svg>
        </a>
      </div>

      <ThemeToggle className="p-0" />
    </div>
  );
}
