try {
   /**
    * Adding this to avoid warnings from node:sqlite being experimental
    */
   const { emitWarning } = process;
   process.emitWarning = (warning: string, ...args: any[]) => {
      if (warning.includes("SQLite is an experimental feature")) return;
      return emitWarning(warning, ...args);
   };
} catch (e) {}

export {
   App,
   createApp,
   AppEvents,
   type AppConfig,
   type CreateAppConfig,
   type AppPlugin,
   type LocalApiOptions,
} from "./App";

export {
   getDefaultConfig,
   getDefaultSchema,
   type ModuleConfigs,
   type ModuleSchemas,
   type ModuleManagerOptions,
   type ModuleBuildContext,
   type InitialModuleConfigs,
   ModuleManagerEvents,
} from "./modules/ModuleManager";

export type { ServerEnv } from "modules/Controller";

/**
 * Bknd Configuration Types
 * 
 * Comprehensive type definitions for bknd configuration with full
 * TypeScript support and IDE autocomplete for custom ID handlers.
 */
export type { 
  BkndConfig,
  FrameworkBkndConfig,
  RuntimeBkndConfig,
  TypedBkndConfig,
  DefaultArgs,
  CreateAdapterAppOptions,
  FrameworkOptions,
  RuntimeOptions,
} from "bknd/adapter";

export * as middlewares from "modules/middlewares";
export { registries } from "modules/registries";
export { getSystemMcp } from "modules/mcp/system-mcp";

/**
 * Core
 */
export type { MaybePromise } from "core/types";
export { Exception, BkndError } from "core/errors";
export { isDebug, env } from "core/env";
export { type PrimaryFieldType, config, type DB, type AppEntity } from "core/config";
export { Permission } from "core/security/Permission";
export { getFlashMessage } from "core/server/flash";
export * from "core/drivers";
export { Event, InvalidEventReturn } from "core/events/Event";
export type {
   ListenerMode,
   ListenerHandler,
} from "core/events/EventListener";
export { EventManager, type EmitsEvents, type EventClass } from "core/events/EventManager";

/**
 * Auth
 */
export {
   UserExistsException,
   UserNotFoundException,
   InvalidCredentialsException,
} from "auth/errors";
export type {
   ProfileExchange,
   User,
   SafeUser,
   CreateUser,
   AuthResponse,
   UserPool,
   AuthAction,
   AuthUserResolver,
} from "auth/authenticate/Authenticator";
export { AuthStrategy } from "auth/authenticate/strategies/Strategy";
export * as AuthPermissions from "auth/auth-permissions";

/**
 * Media
 */
export { getExtensionFromName, getRandomizedFilename } from "media/utils";
import * as StorageEvents from "media/storage/events";
export const MediaEvents = {
   ...StorageEvents,
};
export * as MediaPermissions from "media/media-permissions";
export type { FileUploadedEventData } from "media/storage/events";
export { guess as guessMimeType } from "media/storage/mime-types-tiny";
export {
   Storage,
   type FileMeta,
   type FileListObject,
   type StorageConfig,
   type FileBody,
   type FileUploadPayload,
} from "media/storage/Storage";
export { StorageAdapter } from "media/storage/StorageAdapter";
export { StorageS3Adapter } from "media/storage/adapters/s3/StorageS3Adapter";
export { StorageCloudinaryAdapter } from "media/storage/adapters/cloudinary/StorageCloudinaryAdapter";

/**
 * Data
 */
import { MutatorEvents, RepositoryEvents } from "data/events";
export const DatabaseEvents = { ...MutatorEvents, ...RepositoryEvents };
export type {
   RepoQuery,
   RepoQueryIn,
} from "data/server/query";
export type { WhereQuery } from "data/entities/query/WhereBuilder";
export { KyselyPluginRunner } from "data/plugins/KyselyPluginRunner";
export * as DataPermissions from "data/permissions";
export { libsql } from "data/connection/sqlite/libsql/LibsqlConnection";
export {
   genericSqlite,
   genericSqliteUtils,
   type GenericSqliteConnection,
} from "data/connection/sqlite/GenericSqliteConnection";
export {
   EntityTypescript,
   type EntityTypescriptOptions,
   type TEntityTSType,
   type TFieldTSType,
} from "data/entities/EntityTypescript";
export * from "data/fields/Field";
export * from "data/errors";
export type { EntityRelation } from "data/relations";
export type * from "data/entities/Entity";
export type { EntityManager } from "data/entities/EntityManager";
export type { SchemaManager } from "data/schema/SchemaManager";

/**
 * Custom ID Generation Types
 * 
 * Comprehensive type definitions for the custom ID generation system,
 * providing full TypeScript support and IDE autocomplete.
 */
export type {
  // Core interfaces
  IdHandler,
  IdHandlerRegistryInterface,
  CustomIdHandlerConfig,
  TPrimaryFieldFormat,
  
  // Result interfaces
  ValidationResult,
  HandlerExecutionResult,
  
  // Configuration types
  BkndIdHandlersConfig,
  BkndConfigWithIdHandlers,
  
  // Utility types
  ExtractHandlerFunction,
  TypedHandlerConfig,
} from "data/fields/types";

/**
 * Custom ID Generation Constants
 * 
 * Constants and enums for working with custom ID handlers.
 */
export { 
  ID_HANDLER_CONSTANTS,
  isCustomIdHandlerConfig,
  isBkndIdHandlersConfig 
} from "data/fields/types";

/**
 * Custom ID Generation Registry
 * 
 * Global registry instance for managing custom ID handlers.
 */
export { 
  idHandlerRegistry,
  IdHandlerRegistry 
} from "data/fields/IdHandlerRegistry";
export {
   BaseIntrospector,
   Connection,
   customIntrospector,
   DummyConnection,
   type FieldSpec,
   type IndexSpec,
   type DbFunctions,
   type SchemaResponse,
   type ConnQuery,
   type ConnQueryResults,
} from "data/connection";
export { SqliteConnection } from "data/connection/sqlite/SqliteConnection";
export { SqliteIntrospector } from "data/connection/sqlite/SqliteIntrospector";
export { SqliteLocalConnection } from "data/connection/sqlite/SqliteLocalConnection";
export {
   text,
   number,
   date,
   datetime,
   week,
   boolean,
   enumm,
   json,
   jsonSchema,
   media,
   medium,
   make,
   entity,
   systemEntity,
   relation,
   index,
   em,
   type InferEntityFields,
   type InferFields,
   type Simplify,
   type InferField,
   type InsertSchema,
   type Schema,
   type FieldSchema,
} from "data/prototype";
