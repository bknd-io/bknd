import { Permission } from "core/security/Permission";

export const readFile = new Permission("media.file.read");
export const listFiles = new Permission("media.file.list");
export const uploadFile = new Permission("media.file.upload");
export const deleteFile = new Permission("media.file.delete");
