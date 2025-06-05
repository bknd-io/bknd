import './global.css';
import { RootProvider } from 'fumadocs-ui/provider';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from './layout.config';
import { source } from '@/lib/source';
import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider>
          <DocsLayout tree={source.pageTree} {...baseOptions}>
            {children}
          </DocsLayout>
        </RootProvider>
      </body>
    </html>
  );
}
