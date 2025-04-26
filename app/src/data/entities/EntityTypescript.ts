import { type Entity, type EntityManager, EntityRelation, type TEntityType } from "data";
import { autoFormatString } from "core/utils";

export type TEntityTSType = {
   name: string;
   type: TEntityType;
   comment?: string;
   fields: Record<string, TFieldTSType>;
};

// [select, insert, update]
type TFieldContextType = boolean | [boolean, boolean, boolean];

export type TFieldTSType = {
   required?: TFieldContextType;
   fillable?: TFieldContextType;
   type: "PrimaryFieldType" | string;
   comment?: string;
   import?: {
      package: string;
      name: string;
   }[];
};

export type EntityTypescriptOptions = {
   indentWidth?: number;
   indentChar?: string;
   definition?: "type" | "interface";
   entityCommentMultiline?: boolean;
   fieldCommentMultiline?: boolean;
};

export class EntityTypescript {
   constructor(
      protected em: EntityManager,
      protected _options: EntityTypescriptOptions = {},
   ) {}

   get options() {
      return {
         ...this._options,
         indentWidth: 2,
         indentChar: " ",
         definition: "type",
         entityCommentMultiline: true,
         fieldCommentMultiline: false,
      };
   }

   toTypes() {
      return this.em.entities.map((e) => e.toTypes());
   }

   protected getTab(count = 1) {
      return this.options.indentChar.repeat(this.options.indentWidth).repeat(count);
   }

   collectImports(
      type: TEntityTSType,
      imports: Record<string, string[]> = {},
   ): Record<string, string[]> {
      for (const [, entity_type] of Object.entries(type.fields)) {
         for (const imp of entity_type.import ?? []) {
            const name = imp.name;
            const pkg = imp.package;
            if (!imports[pkg]) {
               imports[pkg] = [];
            }
            if (!imports[pkg].includes(name)) {
               imports[pkg].push(name);
            }
         }
      }
      return imports;
   }

   typeName(name: string) {
      return autoFormatString(name);
   }

   fieldTypesToString(type: TEntityTSType) {
      let string = "";
      const coment_multiline = this.options.fieldCommentMultiline;

      for (const [field_name, field_type] of Object.entries(type.fields)) {
         let f = "";
         f += this.commentString(field_type.comment, 1, coment_multiline);
         f += `${this.getTab(1)}${field_name}${field_type.required ? "" : "?"}: `;
         f += field_type.type + ";";
         f += "\n";
         string += f;
      }

      return string;
   }

   relationToFieldType(relation: EntityRelation, entity: Entity) {
      const other = relation.other(entity);
      const listable = relation.isListableFor(entity);
      const name = this.typeName(other.entity.name);

      return {
         fields: {
            [other.reference]: {
               required: false,
               type: `${name}${listable ? "[]" : ""}`,
            },
         },
      };
   }

   importsToString(imports: Record<string, string[]>) {
      const strings: string[] = [];
      for (const [pkg, names] of Object.entries(imports)) {
         strings.push(`import type { ${names.join(", ")} } from "${pkg}";`);
      }
      return strings;
   }

   commentString(comment?: string, indents = 0, multiline = true) {
      if (!comment) return "";
      const indent = this.getTab(indents);
      if (!multiline) return `${indent}// ${comment}\n`;
      return `${indent}/**\n${indent} * ${comment}\n${indent} */\n`;
   }

   toString() {
      const strings: string[] = [];
      const tables: Record<string, string> = {};
      const imports: Record<string, string[]> = {};

      for (const entity of this.em.entities) {
         const type = entity.toTypes();
         if (!type) continue;
         const name = this.typeName(type.name);
         tables[type.name] = name;
         this.collectImports(type, imports);

         let s = this.commentString(type.comment, 0, this.options.entityCommentMultiline);
         if (this.options.definition === "interface") {
            s += `interface ${name} {\n`;
         } else {
            s += `type ${name} = {\n`;
         }
         s += this.fieldTypesToString(type);

         // add listable relations
         const relations = this.em.relations.relationsOf(entity);
         const rel_types = relations.map((r) =>
            this.relationToFieldType(r, entity),
         ) as TEntityTSType[];
         for (const rel_type of rel_types) {
            s += this.fieldTypesToString(rel_type);
         }
         s += "}";

         strings.push(s);
      }

      // write tables
      let tables_string =
         this.options.definition === "interface" ? "interface Database {\n" : "type Database = {\n";
      for (const [name, type] of Object.entries(tables)) {
         tables_string += `${this.getTab(1)}${name}: ${type};\n`;
      }
      tables_string += "}";
      strings.push(tables_string);

      // merge
      let merge = `declare module "bknd/core" {\n`;
      merge += `${this.getTab(1)}interface DB extends Database {}\n}`;
      strings.push(merge);

      const final = [this.importsToString(imports).join("\n"), strings.join("\n\n")];
      return final.join("\n\n");
   }
}
