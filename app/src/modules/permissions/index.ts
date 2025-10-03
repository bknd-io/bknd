import { Permission } from "core/security/Permission";
import { s } from "bknd/utils";

export const accessAdmin = new Permission("system.access.admin");
export const accessApi = new Permission("system.access.api");
export const configRead = new Permission(
   "system.config.read",
   {},
   s.object({
      module: s.string().optional(),
   }),
);
export const configReadSecrets = new Permission(
   "system.config.read.secrets",
   {},
   s.object({
      module: s.string().optional(),
   }),
);
export const configWrite = new Permission(
   "system.config.write",
   {},
   s.object({
      module: s.string().optional(),
   }),
);
export const schemaRead = new Permission("system.schema.read");
export const build = new Permission("system.build");
export const mcp = new Permission("system.mcp");
