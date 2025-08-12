import type { Entity, EntityManager, TEntityType } from "data/entities";
import type { EntityRelation } from "data/relations";
import { autoFormatString } from "bknd/utils";
import { usersFields } from "auth/auth-entities";
import { mediaFields } from "media/media-entities";

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
   entityCommentMultiline?: boolean;
   fieldCommentMultiline?: boolean;
};

// keep a local copy here until properties have a type
const systemEntities = {
   users: usersFields,
   media: mediaFields,
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
         entityCommentMultiline: true,
         fieldCommentMultiline: false,
      };
   }

   toTypes() {
      return this.em.entities.map((e) => e.toTypes());
   }

   getTab(count = 1) {
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

   fieldTypesToString(type: TEntityTSType, opts?: { ignore_fields?: string[]; indent?: number }) {
      let string = "";
      const coment_multiline = this.options.fieldCommentMultiline;
      const indent = opts?.indent ?? 1;
      for (const [field_name, field_type] of Object.entries(type.fields)) {
         if (opts?.ignore_fields?.includes(field_name)) continue;

         let f = "";
         f += this.commentString(field_type.comment, indent, coment_multiline);
         f += `${this.getTab(indent)}${field_name}${field_type.required ? "" : "?"}: `;
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

      let type = name;
      if (other.entity.type === "system") {
         type = `DB["${other.entity.name}"]`;
      }

      return {
         fields: {
            [other.reference]: {
               required: false,
               type: `${type}${listable ? "[]" : ""}`,
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

   entityToTypeString(
      entity: Entity,
      opts?: { ignore_fields?: string[]; indent?: number; export?: boolean },
   ) {
      const type = entity.toTypes();
      const name = this.typeName(type.name);
      const indent = opts?.indent ?? 1;
      const min_indent = Math.max(0, indent - 1);

      let s = this.commentString(type.comment, min_indent, this.options.entityCommentMultiline);
      s += `${opts?.export ? "export " : ""}interface ${name} {\n`;
      s += this.fieldTypesToString(type, opts);

      // add listable relations
      const relations = this.em.relations.relationsOf(entity);
      const rel_types = relations.map((r) =>
         this.relationToFieldType(r, entity),
      ) as TEntityTSType[];
      for (const rel_type of rel_types) {
         s += this.fieldTypesToString(rel_type, {
            indent,
         });
      }
      s += `${this.getTab(min_indent)}}`;

      return s;
   }

   toString() {
      const strings: string[] = [];
      const tables: Record<string, string> = {};
      const imports: Record<string, string[]> = {
         bknd: ["DB"],
         kysely: ["Insertable", "Selectable", "Updateable", "Generated"],
      };

      // add global types
      let g = "declare global {\n";
      g += `${this.getTab(1)}type BkndEntity<T extends keyof DB> = Selectable<DB[T]>;\n`;
      g += `${this.getTab(1)}type BkndEntityCreate<T extends keyof DB> = Insertable<DB[T]>;\n`;
      g += `${this.getTab(1)}type BkndEntityUpdate<T extends keyof DB> = Updateable<DB[T]>;\n`;
      g += "}";
      strings.push(g);

      const system_entities = this.em.entities.filter((e) => e.type === "system");

      for (const entity of this.em.entities) {
         // skip system entities, declare addtional props in the DB interface
         if (system_entities.includes(entity)) continue;

         const type = entity.toTypes();
         if (!type) continue;
         this.collectImports(type, imports);
         tables[type.name] = this.typeName(type.name);
         const s = this.entityToTypeString(entity, {
            export: true,
         });
         strings.push(s);
      }

      // write tables
      let tables_string = "interface Database {\n";
      for (const [name, type] of Object.entries(tables)) {
         tables_string += `${this.getTab(1)}${name}: ${type};\n`;
      }
      tables_string += "}";
      strings.push(tables_string);

      // merge
      let merge = `declare module "bknd" {\n`;
      for (const systemEntity of system_entities) {
         const system_fields = Object.keys(systemEntities[systemEntity.name]);
         const additional_fields = systemEntity.fields
            .filter((f) => !system_fields.includes(f.name) && f.type !== "primary")
            .map((f) => f.name);
         if (additional_fields.length === 0) continue;

         merge += `${this.getTab(1)}${this.entityToTypeString(systemEntity, {
            ignore_fields: ["id", ...system_fields],
            indent: 2,
         })}\n\n`;
      }

      merge += `${this.getTab(1)}interface DB extends Database {}\n}`;
      strings.push(merge);

      const final = [this.importsToString(imports).join("\n"), strings.join("\n\n")];
      return final.join("\n\n");
   }
}
