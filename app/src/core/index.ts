import type { Hono, MiddlewareHandler } from "hono";

export { tbValidator } from "./server/lib/tbValidator";
export { Exception, BkndError } from "./errors";
export { isDebug, env } from "./env";
export { type PrimaryFieldType, config, type DB, type AppEntity } from "./config";
export { AwsClient } from "./clients/aws/AwsClient";
export {
   SimpleRenderer,
   type TemplateObject,
   type TemplateTypes,
   type SimpleRendererOptions,
} from "./template/SimpleRenderer";
export { SchemaObject } from "./object/SchemaObject";
export { DebugLogger } from "./utils/DebugLogger";
export { Permission } from "./security/Permission";
export {
   exp,
   makeValidator,
   type FilterQuery,
   type Primitive,
   isPrimitive,
   type TExpression,
   type BooleanLike,
   isBooleanLike,
} from "./object/query/query";
export { Registry, type Constructor } from "./registry/Registry";
export { getFlashMessage } from "./server/flash";
export {
   s,
   parse,
   jsc,
   describeRoute,
   schemaToSpec,
   openAPISpecs,
   type ParseOptions,
   InvalidSchemaError,
} from "./object/schema";

export * from "./drivers";
export * from "./events";

// compatibility
export type Middleware = MiddlewareHandler<any, any, any>;
export interface ClassController {
   getController: () => Hono<any, any, any>;
   getMiddleware?: MiddlewareHandler<any, any, any>;
}
