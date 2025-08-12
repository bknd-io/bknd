import { Tool, getPath, s } from "bknd/utils";
import {
   McpSchemaHelper,
   mcpSchemaSymbol,
   type AppToolHandlerCtx,
   type SchemaWithMcpOptions,
} from "./McpSchemaHelper";

export interface SchemaToolSchemaOptions extends s.ISchemaOptions, SchemaWithMcpOptions {}

export const $schema = <
   const S extends s.Schema,
   const O extends SchemaToolSchemaOptions = SchemaToolSchemaOptions,
>(
   name: string,
   schema: S,
   options?: O,
): S => {
   const mcp = new McpSchemaHelper(schema, name, options || {});

   const toolGet = (node: s.Node<S>) => {
      return new Tool(
         [mcp.name, "get"].join("_"),
         {
            ...mcp.getToolOptions("get"),
            inputSchema: s.strictObject({
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
            const value = getPath(configs, node.instancePath);

            return ctx.json({
               secrets: params.secrets ?? false,
               value: value ?? null,
            });
         },
      );
   };

   const toolUpdate = (node: s.Node<S>) => {
      return new Tool(
         [mcp.name, "update"].join("_"),
         {
            ...mcp.getToolOptions("update"),
            inputSchema: s.strictObject({
               value: schema as any,
               return_config: s.boolean({ default: false }).optional(),
               secrets: s.boolean({ default: false }).optional(),
            }),
         },
         async (params, ctx: AppToolHandlerCtx) => {
            const { value, return_config, secrets } = params;
            const [module_name, ...rest] = node.instancePath;

            await ctx.context.app.mutateConfig(module_name as any).overwrite(rest, value);

            let config: any = undefined;
            if (return_config) {
               const configs = ctx.context.app.toJSON(secrets);
               config = getPath(configs, node.instancePath);
            }

            return ctx.json({
               success: true,
               module: module_name,
               config,
            });
         },
      );
   };

   const getTools = (node: s.Node<S>) => {
      const { tools = [] } = mcp.options;
      return [toolGet(node), toolUpdate(node), ...tools];
   };

   return Object.assign(schema, {
      [mcpSchemaSymbol]: mcp,
      getTools,
   });
};
