import "./global.css";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import { baseOptions } from "./layout.config";
import { source } from "@/lib/source";
import { GithubInfo } from "fumadocs-ui/components/github-info";
import type { ReactNode } from "react";
import { Provider } from "./provider";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Provider>
          <DocsLayout
            tree={source.pageTree}
            nav={{ ...baseOptions.nav }}
            tabMode="navbar"
            links={[
              {
                text: "Discord",
                url: "https://discord.gg/952SFk8Tb8",
              },
              {
                type: "custom",
                children: (
                  <GithubInfo
                    owner="bknd-io"
                    repo="bknd"
                    className="lg:-mx-2"
                    token={process.env.GITHUB_TOKEN}
                  />
                ),
              },
            ]}
          >
            {children}
          </DocsLayout>
        </Provider>
      </body>
    </html>
  );
}
