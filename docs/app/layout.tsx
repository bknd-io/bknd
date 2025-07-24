import "./global.css";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { baseOptions } from "./layout.config";
import { source } from "@/lib/source";
import type { ReactNode } from "react";
import { Provider } from "./provider";
import { AnimatedGridPattern } from "./_components/AnimatedGridPattern";
import { FooterIcons } from "./_components/FooterIcons";

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
