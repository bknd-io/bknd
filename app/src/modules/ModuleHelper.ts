import {
   type EntityIndex,
   type EntityRelation,
   type Field,
   type em as prototypeEm,
   FieldPrototype,
   make,
   Entity,
   entityTypes,
} from "data";
import { isEqual } from "lodash-es";
import type { ModuleBuildContext } from "./Module";

export class ModuleHelper {
   constructor(protected ctx: Omit<ModuleBuildContext, "helper">) {}

   get em() {
      return this.ctx.em;
   }

   get flags() {
      return this.ctx.flags;
   }

   ensureEntity(entity: Entity) {
      const instance = this.em.entity(entity.name, true);

      // check fields
      if (!instance) {
         this.em.addEntity(entity);
         this.flags.sync_required = true;
         return;
      }

      // if exists, check all fields required are there
      // @todo: potentially identify system and generated entities and take that as instance
      // @todo: check if the field also equal
      for (const field of entity.fields) {
         const instanceField = instance.field(field.name);
         if (!instanceField) {
            instance.addField(field);
            this.flags.sync_required = true;
         } else {
            const changes = this.setEntityFieldConfigs(field, instanceField);
            if (changes > 0) {
               this.flags.sync_required = true;
            }
         }
      }

      // if type is different, keep the highest
      if (instance.type !== entity.type) {
         const instance_i = entityTypes.indexOf(instance.type);
         const entity_i = entityTypes.indexOf(entity.type);
         const type = entity_i > instance_i ? entity.type : instance.type;

         this.em.__replaceEntity(new Entity(instance.name, instance.fields, instance.config, type));
      }
   }

   ensureIndex(index: EntityIndex) {
      if (!this.em.hasIndex(index)) {
         this.em.addIndex(index);
         this.flags.sync_required = true;
      }
   }

   ensureRelation(relation: EntityRelation) {
      try {
         // most reliable way at the moment
         this.em.addRelation(relation);
         this.flags.sync_required = true;
      } catch (e) {}

      // @todo: improve this function, seems like it still doesn't catch all cases
      if (!this.em.relations.exists(relation)) {
      }
   }

   ensureSchema<Schema extends ReturnType<typeof prototypeEm>>(schema: Schema): Schema {
      Object.values(schema.entities ?? {}).forEach(this.ensureEntity.bind(this));
      schema.indices?.forEach(this.ensureIndex.bind(this));
      schema.relations?.forEach(this.ensureRelation.bind(this));

      return schema;
   }

   setEntityFieldConfigs(
      parent: Field,
      child: Field,
      props: string[] = ["hidden", "fillable", "required"],
   ) {
      let changes = 0;
      for (const prop of props) {
         if (!isEqual(child.config[prop], parent.config[prop])) {
            child.config[prop] = parent.config[prop];
            changes++;
         }
      }
      return changes;
   }

   replaceEntityField(
      _entity: string | Entity,
      field: Field | string,
      _newField: Field | FieldPrototype,
   ) {
      const entity = this.em.entity(_entity);
      const name = typeof field === "string" ? field : field.name;
      const newField =
         _newField instanceof FieldPrototype ? make(name, _newField as any) : _newField;

      // ensure keeping vital config
      this.setEntityFieldConfigs(entity.field(name)!, newField);

      entity.__replaceField(name, newField);
   }
}
