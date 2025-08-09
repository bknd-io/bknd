import { Permission } from "core/security/Permission";

export const createUser = new Permission("auth.user.create");
//export const updateUser = new Permission("auth.user.update");
export const testPassword = new Permission("auth.user.password.test");
export const changePassword = new Permission("auth.user.password.change");
export const createToken = new Permission("auth.user.token.create");
