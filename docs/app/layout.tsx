import "./global.css";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { baseOptions } from "./layout.config";
import { source } from "@/lib/source";
// import { GithubInfo } from "fumadocs-ui/components/github-info";
import type { ReactNode } from "react";
import { Provider } from "./provider";

const githubToken = process.env.GITHUB_TOKEN;

// GitHub API has a strict rate limit (60 req/hour) without authentication.
// Setting a token (even with no scopes) raises the limit to 5000 req/hour.
// Recommended to set GITHUB_TOKEN in your environment for better reliability.
if (!githubToken) {
  console.warn(
    "[Docs] GITHUB_TOKEN is missing. GitHub API will be rate-limited (60 req/hour).",
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Provider>
          <DocsLayout
            tree={source.pageTree}
            // nav={{ ...baseOptions.nav, mode: "top" }}
            // or
            nav={{ ...baseOptions.nav }}
            githubUrl="https://github.com/bknd-io/bknd"
          >
            {children}
          </DocsLayout>
        </Provider>
      </body>
    </html>
  );
}
