import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import * as FilesComponents from 'fumadocs-ui/components/files';
import * as TabsComponents from 'fumadocs-ui/components/tabs';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Callout } from './app/_components/Callout';
import { StackBlitz } from './app/_components/StackBlitz';
import { Icon } from '@iconify/react'

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...TabsComponents,
    ...FilesComponents,
    ...components,
    Accordion,
    Accordions,
    Callout,
    StackBlitz,
    Icon
  };
}
