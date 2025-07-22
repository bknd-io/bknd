import { Permission } from "core/security/Permission";

export const entityRead = new Permission("data.entity.read");
export const entityCreate = new Permission("data.entity.create");
export const entityUpdate = new Permission("data.entity.update");
export const entityDelete = new Permission("data.entity.delete");
export const databaseSync = new Permission("data.database.sync");
export const rawQuery = new Permission("data.raw.query");
export const rawMutate = new Permission("data.raw.mutate");
