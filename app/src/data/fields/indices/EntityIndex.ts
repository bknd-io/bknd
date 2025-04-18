import type { Entity } from "../../entities";
import { Field } from "../Field";

export class EntityIndex {
   constructor(
      public entity: Entity,
      public fields: Field[],
      public unique: boolean = false,
      public name?: string,
   ) {
      if (fields.length === 0) {
         throw new Error("Indices must contain at least one field");
      }
      if (fields.some((f) => !(f instanceof Field))) {
         throw new Error("All fields must be instances of Field");
      }

      if (unique) {
         const firstRequired = fields[0]?.isRequired();
         if (!firstRequired) {
            throw new Error(
               `Unique indices must have first field as required: ${fields
                  .map((f) => f.name)
                  .join(", ")}`,
            );
         }
      }

      if (!name) {
         this.name = [
            unique ? "idx_unique" : "idx",
            entity.name,
            ...fields.map((f) => f.name),
         ].join("_");
      }
   }

   toJSON() {
      return {
         entity: this.entity.name,
         fields: this.fields.map((f) => f.name),
         unique: this.unique,
      };
   }
}
