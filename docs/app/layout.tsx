import "./global.css";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { ThemeToggle } from "fumadocs-ui/components/layout/theme-toggle";
import { Icon } from "@iconify/react";
import { baseOptions } from "./layout.config";
import { source } from "@/lib/source";
import type { ReactNode } from "react";
import { Provider } from "./provider";
import { AnimatedGridPattern } from "./_components/AnimatedGridPattern";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="relative bg-background">
        <div className="absolute top-0 inset-x-0 h-[300px] -z-10 pointer-events-none [mask-image:linear-gradient(to_bottom,black,transparent)]">
          <AnimatedGridPattern className="h-full w-full opacity-15 dark:opacity-10 text-[var(--color-fd-primary)] dark:text-[var(--color-fd-primary)]" />
        </div>

        <Provider>
          <DocsLayout
            tree={source.pageTree}
            nav={{ ...baseOptions.nav }}
            themeSwitch={{
              enabled: true,
              component: <FooterIcons />,
              mode: "light-dark",
            }}
          >
            {children}
          </DocsLayout>
        </Provider>
      </body>
    </html>
  );
}

function FooterIcons() {
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
          <Icon icon="mdi:github" className="w-5 h-5" />
        </a>
        <a
          href="https://discord.gg/952SFk8Tb8"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Discord"
          className="text-fd-muted-foreground hover:text-fd-accent-foreground"
        >
          <Icon icon="simple-icons:discord" className="w-5 h-5" />
        </a>
      </div>

      <ThemeToggle className="p-0" />
    </div>
  );
}
