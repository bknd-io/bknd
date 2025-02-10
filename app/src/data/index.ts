import { MutatorEvents, RepositoryEvents } from "./events";

export * from "./fields";
export * from "./entities";
export * from "./relations";
export * from "./schema/SchemaManager";
export * from "./prototype";

export {
   type RepoQuery,
   type RepoQueryIn,
   defaultQuerySchema,
   querySchema,
   whereSchema
} from "./server/data-query-impl";

export { Connection } from "./connection/Connection";
export { LibsqlConnection, type LibSqlCredentials } from "./connection/LibsqlConnection";
export { SqliteConnection } from "./connection/SqliteConnection";
export { SqliteLocalConnection } from "./connection/SqliteLocalConnection";
export { SqliteIntrospector } from "./connection/SqliteIntrospector";
export { KyselyPluginRunner } from "./plugins/KyselyPluginRunner";

export { constructEntity, constructRelation } from "./schema/constructor";

export const DatabaseEvents = {
   ...MutatorEvents,
   ...RepositoryEvents
};
export { MutatorEvents, RepositoryEvents };

export * as DataPermissions from "./permissions";

export { MediaField, type MediaFieldConfig, type MediaItem } from "media/MediaField";
