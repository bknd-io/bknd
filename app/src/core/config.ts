/**
 * These are package global defaults.
 */
import type { Generated } from "kysely";

export type PrimaryFieldType = number | Generated<number>;

export interface DB {
   // make sure to make unknown as "any"
   [key: string]: {
      id: PrimaryFieldType;
      [key: string]: any;
   };
}

export const config = {
   server: {
      default_port: 1337,
      // resetted to root for now, bc bundling with vite
      assets_path: "/",
   },
   data: {
      default_primary_field: "id",
   },
} as const;
