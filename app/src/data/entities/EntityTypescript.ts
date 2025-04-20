import type { Entity, EntityManager, TEntityType } from "data";
import { autoFormatString } from "core/utils";

export type TEntityTSType = {
   name: string;
   type: TEntityType;
   comment?: string;
   fields: Record<string, TFieldTSType>;
};

export type TFieldTSType = {
   required?: boolean;
   type: "PrimaryFieldType" | string;
   comment?: string;
   import?: {
      package: string;
      name: string;
   }[];
   declare?: {
      name: string;
      type: string;
   }[];
};

export type EntityTypescriptOptions = {
   indentWidth?: number;
   indentChar?: string;
};

export class EntityTypescript {
   constructor(
      protected em: EntityManager,
      protected _options: EntityTypescriptOptions = {},
   ) {}

   get options() {
      return { ...this._options, indentWidth: 2, indentChar: " " };
   }

   toTypes() {
      return this.em.entities.map((e) => e.toTypes());
   }

   protected getTab(count = 1) {
      return this.options.indentChar.repeat(this.options.indentWidth).repeat(count);
   }

   entityToTypesString(entity: Entity) {
      const types = entity.toTypes();
      const entity_name = autoFormatString(types.name);
      let string = `type ${entity_name} = {\n`;

      for (const [field_name, entity_type] of Object.entries(types.fields)) {
         string += `${this.getTab(1)}${field_name}${entity_type.required ? "" : "?"}: ${entity_type.type};\n`;
      }

      string += "}";
      return string;
   }

   entitiesToTypesString() {
      const strings: string[] = [];

      for (const entity of this.em.entities) {
         strings.push(this.entityToTypesString(entity));
      }

      return strings.join("\n\n");
   }
}
