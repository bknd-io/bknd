import { transformObject } from "core/utils";
import { Entity, EntityIndex, type Field } from "data";
import {
   FIELDS,
   RELATIONS,
   type TAppDataEntity,
   type TAppDataField,
   type TAppDataIndex,
   type TAppDataRelation,
} from "data/data-schema";

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

export function constructIndex(
   indexConfig: TAppDataIndex,
   resolver: (name: Entity | string) => Entity,
   name: string,
) {
   const entity = resolver(indexConfig.entity);
   return new EntityIndex(
      entity,
      entity.fields.filter((f) => indexConfig.fields.includes(f.name)),
      indexConfig.unique,
      name,
   );
}
