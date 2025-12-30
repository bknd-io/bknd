import { transformObject } from "bknd/utils";
import { Entity } from "data/entities";
import type { Field } from "data/fields";
import { FIELDS, RELATIONS, type TAppDataEntity, type TAppDataRelation } from "data/data-schema";

export function constructEntity(name: string, entityConfig: TAppDataEntity) {
   const fields = transformObject(entityConfig.fields ?? {}, (fieldConfig, name) => {
      const { type } = fieldConfig;
      if (!(type in FIELDS)) {
         throw new Error(`Field type "${type}" not found`);
      }

      const { field } = FIELDS[type as any];
      const returnal = new field(name, fieldConfig.config) as Field;
      return returnal;
   });

   return new Entity(
      name,
      Object.values(fields),
      entityConfig.config as any,
      entityConfig.type as any,
   );
}

export function constructRelation(
   relationConfig: TAppDataRelation,
   resolver: (name: Entity | string) => Entity,
) {
   return new RELATIONS[relationConfig.type].cls(
      resolver(relationConfig.source),
      resolver(relationConfig.target),
      relationConfig.config,
   );
}
