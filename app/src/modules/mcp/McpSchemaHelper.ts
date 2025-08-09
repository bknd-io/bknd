import type { App } from "bknd";
import {
   type Tool,
   type ToolAnnotation,
   type Resource,
   type ToolHandlerCtx,
   s,
   isPlainObject,
   autoFormatString,
} from "bknd/utils";
import type { ModuleBuildContext } from "modules";
import { excludePropertyTypes, rescursiveClean } from "./utils";

export const mcpSchemaSymbol = Symbol.for("bknd-mcp-schema");

export interface McpToolOptions {
   title?: string;
   description?: string;
   annotations?: ToolAnnotation;
   tools?: Tool<any, any, any>[];
   resources?: Resource<any, any, any, any>[];
}

export interface SchemaWithMcpOptions {
   mcp?: McpToolOptions;
}

export type AppToolContext = {
   app: App;
   ctx: () => ModuleBuildContext;
};
export type AppToolHandlerCtx = ToolHandlerCtx<AppToolContext>;

export interface McpSchema extends s.Schema {
   getTools(node: s.Node<any>): Tool<any, any, any>[];
}

export class McpSchemaHelper {
   cleanSchema: s.ObjectSchema<any, any>;

   constructor(
      public schema: s.Schema,
      public name: string,
      public options: McpToolOptions,
   ) {
      this.cleanSchema = this.getCleanSchema();
   }

   private getCleanSchema() {
      const props = excludePropertyTypes(
         this.schema as any,
         (i) => isPlainObject(i) && mcpSchemaSymbol in i,
      );
      const schema = s.strictObject(props);
      return rescursiveClean(schema, {
         removeRequired: true,
         removeDefault: false,
      }) as s.ObjectSchema<any, any>;
   }

   getToolOptions(suffix?: string) {
      const { tools, resources, ...rest } = this.options;
      const label = (text?: string) =>
         text && [suffix && autoFormatString(suffix), text].filter(Boolean).join(" ");
      return {
         title: label(this.options.title ?? this.schema.title),
         description: label(this.options.description ?? this.schema.description),
         annotations: {
            destructiveHint: true,
            idempotentHint: true,
            ...rest.annotations,
         },
      };
   }
}
