import type { ExpressionBuilder } from "kysely";
import type { Entity, EntityManager } from "../entities";
import { NumberField, TextField } from "../fields";
import type { RepoQuery } from "../server/query";
import { EntityRelation, type KyselyJsonFrom, type KyselyQueryBuilder } from "./EntityRelation";
import { EntityRelationAnchor } from "./EntityRelationAnchor";
import { type RelationType, RelationTypes } from "./relation-types";
import { s } from "bknd/utils";

export type PolymorphicRelationConfig = s.Static<typeof PolymorphicRelation.schema>;

// @todo: what about cascades?
export class PolymorphicRelation extends EntityRelation<typeof PolymorphicRelation.schema> {
   static override schema = s.strictObject({
      targetCardinality: s.number().optional(),
      ...EntityRelation.schema.properties,
   });

   constructor(source: Entity, target: Entity, config: Partial<PolymorphicRelationConfig> = {}) {
      const mappedBy = config.mappedBy || target.name;
      const inversedBy = config.inversedBy || source.name;

      // if target can be multiple, allow it. otherwise unlimited
      const targetCardinality =
         typeof config.targetCardinality === "number" && config.targetCardinality > 0
            ? config.targetCardinality
            : undefined;
      const sourceAnchor = new EntityRelationAnchor(source, inversedBy, 1);
      const targetAnchor = new EntityRelationAnchor(target, mappedBy, targetCardinality);
      super(sourceAnchor, targetAnchor, config);

      this.directions = ["source"];
   }

   type(): RelationType {
      return RelationTypes.Polymorphic;
   }

   private queryInfo(entity: Entity) {
      const other = this.other(entity);
      const whereLhs = `${other.entity.name}.${this.getReferenceField().name}`;
      const reference = `${entity.name}.${this.config.mappedBy}`;

      // this is used for "getReferenceQuery"
      const reference_other = `${other.entity.name}.${this.config.mappedBy}`;

      const entityRef = `${entity.name}.${entity.getPrimaryField().name}`;
      const otherRef = `${other.entity.name}.${this.getEntityIdField().name}`;

      const groupBy = `${entity.name}.${entity.getPrimaryField().name}`;

      return {
         other,
         whereLhs,
         reference,
         reference_other,
         entityRef,
         otherRef,
         groupBy,
      };
   }

   buildJoin(entity: Entity, qb: KyselyQueryBuilder) {
      const { other, whereLhs, reference, entityRef, otherRef, groupBy } = this.queryInfo(entity);

      return qb
         .innerJoin(other.entity.name, (join) =>
            join.onRef(entityRef, "=", otherRef).on(whereLhs, "=", reference),
         )
         .groupBy(groupBy);
   }

   override getReferenceQuery(entity: Entity, id: number): Partial<RepoQuery> {
      const info = this.queryInfo(entity);

      return {
         where: {
            [this.getReferenceField().name]: info.reference_other,
            [this.getEntityIdField().name]: id,
         },
      };
   }

   buildWith(entity: Entity) {
      const { other, whereLhs, reference, entityRef, otherRef } = this.queryInfo(entity);

      return (eb: ExpressionBuilder<any, any>) =>
         eb
            .selectFrom(other.entity.name)
            .where(whereLhs, "=", reference)
            .whereRef(entityRef, "=", otherRef)
            .$if(other.cardinality === 1, (qb) => qb.limit(1));
   }

   override isListableFor(entity: Entity): boolean {
      // @todo: only make listable if many? check cardinality
      return this.source.entity.name === entity.name && this.target.cardinality !== 1;
   }

   getReferenceField(): TextField {
      return new TextField("reference", { hidden: true, fillable: ["create"] });
   }

   getEntityIdField(): NumberField {
      return new NumberField("entity_id", { hidden: true, fillable: ["create"] });
   }

   initialize(em: EntityManager<any>) {
      const referenceField = this.getReferenceField();
      const entityIdField = this.getEntityIdField();

      if (!this.target.entity.field(referenceField.name)) {
         this.target.entity.addField(referenceField);
      }
      if (!this.target.entity.field(entityIdField.name)) {
         this.target.entity.addField(entityIdField);
      }
   }
}
