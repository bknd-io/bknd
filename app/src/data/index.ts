import { MutatorEvents, RepositoryEvents } from "./events";

export * from "./fields";
export * from "./entities";
export * from "./relations";
export * from "./schema/SchemaManager";
export * from "./prototype";
export * from "./connection";

export {
   type RepoQuery,
   type RepoQueryIn,
   getRepoQueryTemplate,
   repoQuery,
} from "./server/query";

export type { WhereQuery } from "./entities/query/WhereBuilder";

export { KyselyPluginRunner } from "./plugins/KyselyPluginRunner";

export { constructEntity, constructRelation } from "./schema/constructor";

export const DatabaseEvents = {
   ...MutatorEvents,
   ...RepositoryEvents,
};
export { MutatorEvents, RepositoryEvents };

export * as DataPermissions from "./permissions";

export { MediaField, type MediaFieldConfig, type MediaItem } from "media/MediaField";

export { libsql } from "./connection/sqlite/libsql/LibsqlConnection";
export {
   genericSqlite,
   genericSqliteUtils,
   type GenericSqliteConnection,
} from "./connection/sqlite/GenericSqliteConnection";

export {
   EntityTypescript,
   type EntityTypescriptOptions,
   type TEntityTSType,
   type TFieldTSType,
} from "./entities/EntityTypescript";
