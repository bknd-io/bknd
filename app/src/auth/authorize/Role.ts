import { Permission } from "core/security/Permission";

export class RolePermission {
   constructor(
      public permission: Permission,
      public config?: any,
   ) {}
}

export class Role {
   constructor(
      public name: string,
      public permissions: RolePermission[] = [],
      public is_default: boolean = false,
      public implicit_allow: boolean = false,
   ) {}

   static createWithPermissionNames(
      name: string,
      permissionNames: string[],
      is_default: boolean = false,
      implicit_allow: boolean = false,
   ) {
      return new Role(
         name,
         permissionNames.map((name) => new RolePermission(new Permission(name))),
         is_default,
         implicit_allow,
      );
   }

   static create(config: {
      name: string;
      permissions?: string[];
      is_default?: boolean;
      implicit_allow?: boolean;
   }) {
      return new Role(
         config.name,
         config.permissions?.map((name) => new RolePermission(new Permission(name))) ?? [],
         config.is_default,
         config.implicit_allow,
      );
   }
}
