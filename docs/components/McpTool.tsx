import type { Tool } from "jsonv-ts/mcp";
import components from "fumadocs-ui/mdx";
import { TypeTable } from "fumadocs-ui/components/type-table";
import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";

import type { JSONSchemaDefinition } from "jsonv-ts";

export const slugify = (s: string) => s.toLowerCase().replace(/ /g, "-");
export const indent = (s: string, indent = 2) => s.replace(/^/gm, " ".repeat(indent));

export function McpTool({ tool }: { tool: ReturnType<Tool["toJSON"]> }) {
   return (
      <div>
         <components.h3 id={slugify(tool.name)}>
            <code>{tool.name}</code>
         </components.h3>
         <p>{tool.description}</p>

         <JsonSchemaTypeTable schema={tool.inputSchema} />
      </div>
   );
}

export function JsonSchemaTypeTable({ schema }: { schema: JSONSchemaDefinition }) {
   const properties = schema.properties ?? {};
   const required = schema.required ?? [];
   const getTypeDescription = (value: any) =>
      JSON.stringify(
         {
            ...value,
            $target: undefined,
         },
         null,
         2,
      );

   return Object.keys(properties).length > 0 ? (
      <TypeTable
         type={Object.fromEntries(
            Object.entries(properties).map(([key, value]: [string, JSONSchemaDefinition]) => [
               key,
               {
                  description: value.description,
                  typeDescription: (
                     <DynamicCodeBlock lang="json" code={indent(getTypeDescription(value), 1)} />
                  ),
                  type: value.type,
                  default: value.default ? JSON.stringify(value.default) : undefined,
                  required: required.includes(key),
               },
            ]),
         )}
      />
   ) : null;
}
