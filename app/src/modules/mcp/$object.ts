import { excludePropertyTypes, rescursiveClean } from "./utils";
import {
   type Resource,
   Tool,
   type ToolAnnotation,
   type ToolHandlerCtx,
   autoFormatString,
   getPath,
   s,
} from "bknd/utils";
import type { App } from "App";
import type { ModuleBuildContext } from "modules";

export interface McpToolOptions {
   title?: string;
   description?: string;
   annotations?: ToolAnnotation;
   tools?: Tool<any, any, any>[];
   resources?: Resource<any, any, any, any>[];
}

export interface ObjectToolSchemaOptions extends s.IObjectOptions {
   mcp?: McpToolOptions;
}

type AppToolContext = {
   app: App;
   ctx: () => ModuleBuildContext;
};
type AppToolHandlerCtx = ToolHandlerCtx<AppToolContext>;

export class ObjectToolSchema<
   const P extends s.TProperties = s.TProperties,
   const O extends s.IObjectOptions = s.IObjectOptions,
> extends s.ObjectSchema<P, O> {
   public readonly mcp: McpToolOptions;
   private cleanSchema: s.ObjectSchema<P, O>;

   constructor(
      public name: string,
      properties: P,
      options?: ObjectToolSchemaOptions,
   ) {
      const { mcp, ...rest } = options || {};

      super(properties, rest as any);
      this.name = name;
      this.mcp = mcp || {};
      this.cleanSchema = this.getCleanSchema();
   }

   private getMcpOptions(action: "get" | "update") {
      const { tools, resources, ...rest } = this.mcp;
      const label = (text?: string) =>
         text && [autoFormatString(action), text].filter(Boolean).join(" ");
      return {
         title: label(this.title ?? this.mcp.title),
         description: label(this.description ?? this.mcp.description),
         annotations: {
            destructiveHint: true,
            idempotentHint: true,
            ...rest.annotations,
         },
      };
   }

   private getCleanSchema() {
      const props = excludePropertyTypes(this as any, [ObjectToolSchema]);
      const schema = s.strictObject(props);
      return rescursiveClean(schema, {
         removeRequired: true,
         removeDefault: false,
      }) as s.ObjectSchema<P, O>;
   }

   private toolGet(node: s.Node<ObjectToolSchema>) {
      return new Tool(
         [this.name, "get"].join("_"),
         {
            ...this.getMcpOptions("get"),
            inputSchema: s.strictObject({
               path: s
                  .string({
                     pattern: /^[a-zA-Z0-9_.]{0,}$/,
                     description: "(optional) path to the property to get, e.g. `key.subkey`",
                  })
                  .optional(),
               include_secrets: s.boolean({ default: false }).optional(),
            }),
         },
         async (params, ctx: AppToolHandlerCtx) => {
            const configs = ctx.context.app.toJSON(params.include_secrets);
            const config = getPath(configs, node.instancePath);
            const value = getPath(config, params.path ?? []);
            return ctx.json({
               path: params.path ?? "",
               value: value ?? null,
            });
         },
      );
   }

   private toolUpdate(node: s.Node<ObjectToolSchema>) {
      const schema = this.cleanSchema;
      return new Tool(
         [this.name, "update"].join("_"),
         {
            ...this.getMcpOptions("update"),
            inputSchema: s.strictObject({
               full: s.boolean({ default: false }).optional(),
               value: s
                  .strictObject(schema.properties as any)
                  .partial() as unknown as s.ObjectSchema<P, O>,
            }),
         },
         async (params, ctx: AppToolHandlerCtx) => {
            return ctx.json(params);
         },
      );
   }

   getTools(node: s.Node<ObjectToolSchema>): Tool<any, any, any>[] {
      const { tools = [] } = this.mcp;
      return [this.toolGet(node), this.toolUpdate(node), ...tools];
   }

   override toJSON(): s.JSONSchemaDefinition {
      const { toJSON, "~standard": _, mcp, cleanSchema, name, ...rest } = this;
      return JSON.parse(JSON.stringify(rest));
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
