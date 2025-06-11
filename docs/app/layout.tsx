import './global.css';
import { RootProvider } from 'fumadocs-ui/provider';
import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import { baseOptions } from './layout.config';
import { source } from '@/lib/source';
import { GithubInfo } from 'fumadocs-ui/components/github-info';
import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider>
          <DocsLayout
            tree={source.pageTree}
            nav={{ ...baseOptions.nav, mode: 'top' }}
            links={[
              {
                text: 'Discord',
                url: 'https://discord.gg/952SFk8Tb8',
              },
              {
                type: 'custom',
                children: (
                  <GithubInfo owner="bknd-io" repo="bknd" className="lg:-mx-2" />
                ),
              },
            ]}
          >
            {children}
          </DocsLayout>
        </RootProvider>
      </body>
    </html>
  );
}
