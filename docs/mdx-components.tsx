import defaultMdxComponents from "fumadocs-ui/mdx";
import { APIPage } from "fumadocs-openapi/ui";
import { openapi } from "@/lib/source";
import type { MDXComponents } from "mdx/types";
import * as FilesComponents from "fumadocs-ui/components/files";
import * as TabsComponents from "fumadocs-ui/components/tabs";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import {
  CalloutInfo,
  CalloutPositive,
  CalloutCaution,
  CalloutDanger,
} from "./app/_components/Callout";
import { StackBlitz } from "./app/_components/StackBlitz";
import { Icon } from "@iconify/react";

import * as Twoslash from "fumadocs-twoslash/ui";

import { createGenerator } from "fumadocs-typescript";
import { AutoTypeTable } from "fumadocs-typescript/ui";

const generator = createGenerator({
  tsconfigPath: "../tsconfig.json",
});

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...TabsComponents,
    ...FilesComponents,
    ...Twoslash,
    Accordion,
    Accordions,
    CalloutInfo,
    CalloutPositive,
    CalloutCaution,
    CalloutDanger,
    StackBlitz,
    Icon,
    APIPage: (props) => <APIPage {...openapi.getAPIPageProps(props)} />,
    AutoTypeTable: (props) => (
      <AutoTypeTable {...props} generator={generator} />
    ),
    ...components,
  };
}
