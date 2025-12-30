import { deno } from "cli/commands/create/templates/deno";
import { cloudflare } from "./cloudflare";

export type TemplateSetupCtx = {
   template: Template;
   dir: string;
   name: string;
   skip: boolean;
};

export type Integration =
   | "node"
   | "bun"
   | "cloudflare"
   | "nextjs"
   | "react-router"
   | "astro"
   | "aws"
   | "deno"
   | "custom";

type TemplateScripts = "install" | "dev" | "build" | "start";
export type Template = {
   /**
    * unique key for the template
    */
   key: string;
   /**
    * the integration this template is for
    */
   integration: Integration;
   title: string;
   description?: string;
   path: string;
   /**
    * adds a ref "#{ref}" to the path. If "true", adds the current version of bknd
    */
   ref?: true | string;
   /**
    * control whether to install dependencies automatically
    * e.g. on deno, this is not needed
    */
   installDeps?: boolean;
   scripts?: Partial<Record<TemplateScripts, string>>;
   preinstall?: (ctx: TemplateSetupCtx) => Promise<void>;
   postinstall?: (ctx: TemplateSetupCtx) => Promise<void>;
   setup?: (ctx: TemplateSetupCtx) => Promise<void>;
};

export const templates: Template[] = [
   cloudflare,
   {
      key: "node",
      title: "Node.js Basic",
      integration: "node",
      description: "A basic bknd Node.js server",
      path: "gh:bknd-io/bknd/examples/node",
      ref: true,
   },
   {
      key: "bun",
      title: "Bun Basic",
      integration: "bun",
      description: "A basic bknd Bun server",
      path: "gh:bknd-io/bknd/examples/bun",
      ref: true,
   },
   {
      key: "nextjs",
      title: "Next.js Basic",
      integration: "nextjs",
      description: "A basic bknd Next.js starter",
      path: "gh:bknd-io/bknd/examples/nextjs",
      ref: true,
   },
   {
      key: "astro",
      title: "Astro Basic",
      integration: "astro",
      description: "A basic bknd Astro starter",
      path: "gh:bknd-io/bknd/examples/astro",
      ref: true,
   },
   {
      key: "react-router",
      title: "React Router Basic",
      integration: "react-router",
      description: "A basic bknd React Router starter",
      path: "gh:bknd-io/bknd/examples/react-router",
      ref: true,
   },
   {
      key: "aws",
      title: "AWS Lambda Basic",
      integration: "aws",
      description: "A basic bknd AWS Lambda starter",
      path: "gh:bknd-io/bknd/examples/aws-lambda",
      ref: true,
   },
   deno,
];
