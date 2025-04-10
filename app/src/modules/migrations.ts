import { transformObject } from "core/utils";
import type { Kysely } from "kysely";
import { set } from "lodash-es";

export type MigrationContext = {
   db: Kysely<any>;
};
export type GenericConfigObject = Record<string, any>;

export type Migration = {
   version: number;
   schema?: true;
   up: (config: GenericConfigObject, ctx: MigrationContext) => Promise<GenericConfigObject>;
};

export const migrations: Migration[] = [
   {
      version: 1,
      up: async (config) => config,
   },
   {
      version: 2,
      up: async (config, { db }) => {
         return config;
      },
   },
   {
      version: 3,
      up: async (config) => config,
   },
   {
      version: 4,
      up: async (config, { db }) => {
         return {
            ...config,
            auth: {
               ...config.auth,
               basepath: "/api/auth2",
            },
         };
      },
   },
   {
      version: 5,
      up: async (config, { db }) => {
         const cors = config.server.cors?.allow_methods ?? [];
         set(config.server, "cors.allow_methods", [...new Set([...cors, "PATCH"])]);
         return config;
      },
   },
   {
      version: 6,
      up: async (config, { db }) => {
         return config;
      },
   },
   {
      version: 7,
      up: async (config, { db }) => {
         // automatically adds auth.cookie options
         // remove "expiresIn" (string), it's now "expires" (number)
         const { expiresIn, ...jwt } = config.auth.jwt;
         return {
            ...config,
            auth: {
               ...config.auth,
               jwt,
            },
         };
      },
   },
   {
      version: 8,
      up: async (config) => {
         const strategies = transformObject(config.auth.strategies, (strategy) => {
            return {
               ...strategy,
               enabled: true,
            };
         });

         return {
            ...config,
            auth: {
               ...config.auth,
               strategies: strategies,
            },
         };
      },
   },
   {
      // remove admin config
      version: 9,
      up: async (config) => {
         const { admin, ...server } = config.server;
         return {
            ...config,
            server,
         };
      },
   },
];

export const CURRENT_VERSION = migrations[migrations.length - 1]?.version ?? 0;
export const TABLE_NAME = "__bknd";

export async function migrateTo(
   current: number,
   to: number,
   config: GenericConfigObject,
   ctx: MigrationContext,
): Promise<[number, GenericConfigObject]> {
   const todo = migrations.filter((m) => m.version > current && m.version <= to);
   let updated = Object.assign({}, config);

   let i = 0;
   let version = current;
   for (const migration of todo) {
      try {
         updated = await migration.up(updated, ctx);
         version = migration.version;
         i++;
      } catch (e: any) {
         console.error(e);
         throw new Error(`Migration ${migration.version} failed: ${e.message}`);
      }
   }

   return [version, updated];
}

export async function migrate(
   current: number,
   config: GenericConfigObject,
   ctx: MigrationContext,
): Promise<[number, GenericConfigObject]> {
   return migrateTo(current, CURRENT_VERSION, config, ctx);
}
