import type { DB, Field } from "bknd";
import type { ReactNode } from "react";
import type { Entity } from "data/entities";
import { useBknd } from "ui/client/BkndProvider";
import type { DropdownProps } from "ui/components/overlay/Dropdown";
import type { ButtonProps } from "ui/components/buttons/Button";

export type BkndAdminEntityContext = "list" | "create" | "update";

export type BkndAdminEntitiesOptions = {
   [E in keyof DB]?: BkndAdminEntityOptions<E>;
};

export type BkndAdminEntityOptions<E extends keyof DB | string> = {
   /**
    * Header to be rendered depending on the context
    */
   header?: (
      context: BkndAdminEntityContext,
      entity: Entity,
      data?: DB[E],
   ) => ReactNode | void | undefined;
   /**
    * Footer to be rendered depending on the context
    */
   footer?: (
      context: BkndAdminEntityContext,
      entity: Entity,
      data?: DB[E],
   ) => ReactNode | void | undefined;
   /**
    * Actions to be rendered depending on the context
    */
   actions?: (
      context: BkndAdminEntityContext,
      entity: Entity,
      data?: DB[E],
   ) => {
      /**
       * Primary actions are always visible
       */
      primary?: (ButtonProps | undefined | null | false)[];
      /**
       * Context actions are rendered in a dropdown
       */
      context?: DropdownProps["items"];
   };
   /**
    * Field UI overrides
    */
   fields?: {
      [F in keyof DB[E]]?: BkndAdminEntityFieldOptions<E>;
   };
};

export type BkndAdminEntityFieldOptions<E extends keyof DB | string> = {
   /**
    * Override the rendering of a certain field
    */
   render?: (
      context: BkndAdminEntityContext,
      entity: Entity,
      field: Field,
      ctx: {
         data?: DB[E];
         value?: DB[E][keyof DB[E]];
         handleChange: (value: any) => void;
      },
   ) => ReactNode | void | undefined;
};

export function useEntityAdminOptions(entity: Entity, context: BkndAdminEntityContext, data?: any) {
   const b = useBknd();
   const opts = b.options?.entities?.[entity.name];
   const footer = opts?.footer?.(context, entity, data) ?? null;
   const header = opts?.header?.(context, entity, data) ?? null;
   const actions = opts?.actions?.(context, entity, data);

   return {
      footer,
      header,
      field: (name: string) => opts?.fields?.[name],
      actions,
   };
}
