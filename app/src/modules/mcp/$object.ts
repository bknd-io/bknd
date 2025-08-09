import { Tool, getPath, limitObjectDepth, s } from "bknd/utils";
import {
   McpSchemaHelper,
   mcpSchemaSymbol,
   type AppToolHandlerCtx,
   type McpSchema,
   type SchemaWithMcpOptions,
} from "./McpSchemaHelper";
import type { Module } from "modules/Module";

export interface ObjectToolSchemaOptions extends s.IObjectOptions, SchemaWithMcpOptions {}

export class ObjectToolSchema<
      const P extends s.TProperties = s.TProperties,
      const O extends ObjectToolSchemaOptions = ObjectToolSchemaOptions,
   >
   extends s.ObjectSchema<P, O>
   implements McpSchema
{
   constructor(name: string, properties: P, options?: ObjectToolSchemaOptions) {
      const { mcp, ...rest } = options || {};

      super(properties, rest as any);
      this[mcpSchemaSymbol] = new McpSchemaHelper(this, name, mcp || {});
   }

   get mcp(): McpSchemaHelper {
      return this[mcpSchemaSymbol];
   }

   private toolGet(node: s.Node<ObjectToolSchema>) {
      return new Tool(
         [this.mcp.name, "get"].join("_"),
         {
            ...this.mcp.getToolOptions("get"),
            inputSchema: s.strictObject({
               path: s
                  .string({
                     pattern: /^[a-zA-Z0-9_.]{0,}$/,
                     title: "Path",
                     description: "Path to the property to get, e.g. `key.subkey`",
                  })
                  .optional(),
               depth: s
                  .number({
                     description: "Limit the depth of the response",
                  })
                  .optional(),
               secrets: s
                  .boolean({
                     default: false,
                     description: "Include secrets in the response config",
                  })
                  .optional(),
            }),
         },
         async (params, ctx: AppToolHandlerCtx) => {
            const configs = ctx.context.app.toJSON(params.secrets);
            const config = getPath(configs, node.instancePath);
            let value = getPath(config, params.path ?? []);

            if (params.depth) {
               value = limitObjectDepth(value, params.depth);
            }

            return ctx.json({
               path: params.path ?? "",
               secrets: params.secrets ?? false,
               partial: !!params.depth,
               value: value ?? null,
            });
         },
      );
   }

   private toolUpdate(node: s.Node<ObjectToolSchema>) {
      const schema = this.mcp.cleanSchema;
      return new Tool(
         [this.mcp.name, "update"].join("_"),
         {
            ...this.mcp.getToolOptions("update"),
            inputSchema: s.strictObject({
               full: s.boolean({ default: false }).optional(),
               return_config: s
                  .boolean({
                     default: false,
                     description: "If the new configuration should be returned",
                  })
                  .optional(),
               value: s.strictObject(schema.properties as {}).partial(),
            }),
         },
         async (params, ctx: AppToolHandlerCtx) => {
            const { full, value, return_config } = params;
            const [module_name] = node.instancePath;

            if (full) {
               await ctx.context.app.mutateConfig(module_name as any).set(value);
            } else {
               await ctx.context.app.mutateConfig(module_name as any).patch("", value);
            }

            let config: any = undefined;
            if (return_config) {
               const configs = ctx.context.app.toJSON();
               config = getPath(configs, node.instancePath);
            }

            return ctx.json({
               success: true,
               module: module_name,
               config,
            });
         },
      );
   }

   getTools(node: s.Node<ObjectToolSchema>): Tool<any, any, any>[] {
      const { tools = [] } = this.mcp.options;
      return [this.toolGet(node), this.toolUpdate(node), ...tools];
   }
}

export const $object = <
   const P extends s.TProperties = s.TProperties,
   const O extends ObjectToolSchemaOptions = ObjectToolSchemaOptions,
>(
   name: string,
   properties: P,
   options?: s.StrictOptions<ObjectToolSchemaOptions, O>,
): ObjectToolSchema<P, O> & O => {
   return new ObjectToolSchema(name, properties, options) as any;
};
