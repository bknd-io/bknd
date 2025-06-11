import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import * as FilesComponents from 'fumadocs-ui/components/files';
import * as TabsComponents from 'fumadocs-ui/components/tabs';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { CalloutInfo, CalloutPositive, CalloutCaution, CalloutDanger } from './app/_components/Callout';
import { StackBlitz } from './app/_components/StackBlitz';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...TabsComponents,
    ...FilesComponents,
    ...components,
    Accordion,
    Accordions,
    CalloutInfo,
    CalloutPositive,
    CalloutCaution,
    CalloutDanger,
    StackBlitz,
  };
}
