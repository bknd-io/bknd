import { getPath, s, Tool } from "bknd/utils";
import {
   McpSchemaHelper,
   mcpSchemaSymbol,
   type AppToolHandlerCtx,
   type McpSchema,
   type SchemaWithMcpOptions,
} from "./McpSchemaHelper";

export interface RecordToolSchemaOptions extends s.IRecordOptions, SchemaWithMcpOptions {}

const opts = Symbol.for("bknd-mcp-record-opts");

export class RecordToolSchema<
      AP extends s.Schema,
      O extends RecordToolSchemaOptions = RecordToolSchemaOptions,
   >
   extends s.RecordSchema<AP, O>
   implements McpSchema
{
   constructor(name: string, ap: AP, options?: RecordToolSchemaOptions, new_schema?: s.Schema) {
      const { mcp, ...rest } = options || {};
      super(ap, rest as any);

      this[mcpSchemaSymbol] = new McpSchemaHelper(this, name, mcp || {});
      this[opts] = {
         new_schema,
      };
   }

   get mcp(): McpSchemaHelper {
      return this[mcpSchemaSymbol];
   }

   private toolGet(node: s.Node<RecordToolSchema<AP, O>>) {
      return new Tool(
         [this.mcp.name, "get"].join("_"),
         {
            ...this.mcp.getToolOptions("get"),
            inputSchema: s.strictObject({
               key: s
                  .string({
                     description: "key to get",
                  })
                  .optional(),
               secrets: s
                  .boolean({
                     default: false,
                     description: "(optional) include secrets in the response config",
                  })
                  .optional(),
               schema: s
                  .boolean({
                     default: false,
                     description: "(optional) include the schema in the response",
                  })
                  .optional(),
            }),
         },
         async (params, ctx: AppToolHandlerCtx) => {
            const configs = ctx.context.app.toJSON(params.secrets);
            const config = getPath(configs, node.instancePath);

            // @todo: add schema to response

            if (params.key) {
               if (!(params.key in config)) {
                  throw new Error(`Key "${params.key}" not found in config`);
               }
               const value = getPath(config, params.key);
               return ctx.json({
                  secrets: params.secrets ?? false,
                  key: params.key,
                  value: value ?? null,
               });
            }

            return ctx.json({
               secrets: params.secrets ?? false,
               key: null,
               value: config ?? null,
            });
         },
      );
   }

   private toolAdd(node: s.Node<RecordToolSchema<AP, O>>) {
      return new Tool(
         [this.mcp.name, "add"].join("_"),
         {
            ...this.mcp.getToolOptions("add"),
            inputSchema: s.strictObject({
               key: s.string({
                  description: "key to add",
               }),
               value: this[opts].new_schema ?? this.additionalProperties,
            }),
         },
         async (params, ctx: AppToolHandlerCtx) => {
            const configs = ctx.context.app.toJSON();
            const config = getPath(configs, node.instancePath);

            if (params.key in config) {
               throw new Error(`Key "${params.key}" already exists in config`);
            }

            return ctx.json({
               key: params.key,
               value: params.value ?? null,
            });
         },
      );
   }

   private toolUpdate(node: s.Node<RecordToolSchema<AP, O>>) {
      return new Tool(
         [this.mcp.name, "update"].join("_"),
         {
            ...this.mcp.getToolOptions("update"),
            inputSchema: s.strictObject({
               key: s.string({
                  description: "key to update",
               }),
               value: this[opts].new_schema ?? s.object({}),
            }),
         },
         async (params, ctx: AppToolHandlerCtx) => {
            const configs = ctx.context.app.toJSON(params.secrets);
            const config = getPath(configs, node.instancePath);

            if (!(params.key in config)) {
               throw new Error(`Key "${params.key}" not found in config`);
            }

            const value = getPath(config, params.key);
            return ctx.json({
               updated: false,
               key: params.key,
               value: value ?? null,
            });
         },
      );
   }

   private toolRemove(node: s.Node<RecordToolSchema<AP, O>>) {
      return new Tool(
         [this.mcp.name, "remove"].join("_"),
         {
            ...this.mcp.getToolOptions("get"),
            inputSchema: s.strictObject({
               key: s.string({
                  description: "key to remove",
               }),
            }),
         },
         async (params, ctx: AppToolHandlerCtx) => {
            const configs = ctx.context.app.toJSON();
            const config = getPath(configs, node.instancePath);

            if (!(params.key in config)) {
               throw new Error(`Key "${params.key}" not found in config`);
            }

            return ctx.json({
               removed: false,
               key: params.key,
            });
         },
      );
   }

   getTools(node: s.Node<RecordToolSchema<AP, O>>): Tool<any, any, any>[] {
      const { tools = [] } = this.mcp.options;

      return [
         this.toolGet(node),
         this.toolAdd(node),
         this.toolUpdate(node),
         this.toolRemove(node),
         ...tools,
      ].filter(Boolean) as Tool<any, any, any>[];
   }
}

export const $record = <const AP extends s.Schema, const O extends RecordToolSchemaOptions>(
   name: string,
   ap: AP,
   options?: s.StrictOptions<RecordToolSchemaOptions, O>,
   new_schema?: s.Schema,
): RecordToolSchema<AP, O> => new RecordToolSchema(name, ap, options, new_schema) as any;
