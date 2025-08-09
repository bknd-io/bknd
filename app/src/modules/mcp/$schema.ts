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
               full: s.boolean({ default: false }).optional(),
               value: schema as any,
            }),
         },
         async (params, ctx: AppToolHandlerCtx) => {
            return ctx.json(params);
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
