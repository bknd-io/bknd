import { Permission } from "auth/authorize/Permission";
import { s } from "bknd/utils";

export const entityRead = new Permission(
   "data.entity.read",
   {
      filterable: true,
   },
   s.object({
      entity: s.string(),
      id: s.anyOf([s.number(), s.string()]).optional(),
   }),
);
/**
 * Filter filters content given
 */
export const entityCreate = new Permission(
   "data.entity.create",
   {
      filterable: true,
   },
   s.object({
      entity: s.string(),
   }),
);
/**
 * Filter filters where clause
 */
export const entityUpdate = new Permission(
   "data.entity.update",
   {
      filterable: true,
   },
   s.object({
      entity: s.string(),
      id: s.anyOf([s.number(), s.string()]).optional(),
   }),
);
export const entityDelete = new Permission(
   "data.entity.delete",
   {
      filterable: true,
   },
   s.object({
      entity: s.string(),
      id: s.anyOf([s.number(), s.string()]).optional(),
   }),
);
export const databaseSync = new Permission("data.database.sync");
export const rawQuery = new Permission("data.raw.query");
export const rawMutate = new Permission("data.raw.mutate");
