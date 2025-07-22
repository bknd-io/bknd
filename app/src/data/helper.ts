import type { EntityData, EntityManager } from "data/entities";
import type { Field } from "data/fields";
import { transform } from "lodash-es";

export function getDefaultValues(fields: Field[], data: EntityData): EntityData {
   return transform(
      fields,
      (acc, field) => {
         // form fields don't like "null" or "undefined", so return empty string
         acc[field.name] = field.getValue(data?.[field.name], "form") ?? "";
      },
      {} as EntityData,
   );
}

export function getChangeSet(
   action: string,
   formData: EntityData,
   data: EntityData,
   fields: Field[],
): EntityData {
   return transform(
      formData,
      (acc, _value, key) => {
         const field = fields.find((f) => f.name === key);
         // @todo: filtering virtual here, need to check (because of media)
         if (!field || field.isVirtual()) return;
         const value = _value === "" ? null : _value;

         // normalize to null if undefined
         const newValue = field.getValue(value, "submit") || null;
         // @todo: add typing for "action"
         if (action === "create" || newValue !== data[key]) {
            acc[key] = newValue;
         }
      },
      {} as typeof formData,
   );
}

export function readableEmJson(_em: EntityManager) {
   return {
      entities: _em.entities.map((e) => ({
         name: e.name,
         fields: e.fields.map((f) => f.name),
         type: e.type,
      })),
      indices: _em.indices.map((i) => ({
         name: i.name,
         entity: i.entity.name,
         fields: i.fields.map((f) => f.name),
         unique: i.unique,
      })),
      relations: _em.relations.all.map((r) => ({
         name: r.getName(),
         ...r.toJSON(),
      })),
   };
}
