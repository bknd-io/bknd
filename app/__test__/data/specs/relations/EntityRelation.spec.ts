import { describe, expect, it, test } from "bun:test";
import { Entity, type EntityManager } from "data/entities";
import {
   type BaseRelationConfig,
   EntityRelation,
   EntityRelationAnchor,
   RelationTypes,
} from "data/relations";

class TestEntityRelation extends EntityRelation {
   constructor(config?: BaseRelationConfig) {
      super(
         new EntityRelationAnchor(new Entity("source"), "source"),
         new EntityRelationAnchor(new Entity("target"), "target"),
         config,
      );
   }
   initialize(em: EntityManager<any>) {}
   type() {
      return RelationTypes.ManyToOne; /* doesn't matter */
   }
   setDirections(directions: ("source" | "target")[]) {
      this.directions = directions;
      return this;
   }

   buildWith(): any {
      return;
   }

   buildJoin(): any {
      return;
   }
}

describe("[data] EntityRelation", async () => {
   test("other", async () => {
      const relation = new TestEntityRelation();
      expect(relation.other("source").entity.name).toBe("target");
      expect(relation.other("target").entity.name).toBe("source");
   });

   it("visibleFrom", async () => {
      const relation = new TestEntityRelation();
      // by default, both sides are visible
      expect(relation.visibleFrom("source")).toBe(true);
      expect(relation.visibleFrom("target")).toBe(true);

      // make source invisible
      relation.setDirections(["target"]);
      expect(relation.visibleFrom("source")).toBe(false);
      expect(relation.visibleFrom("target")).toBe(true);

      // make target invisible
      relation.setDirections(["source"]);
      expect(relation.visibleFrom("source")).toBe(true);
      expect(relation.visibleFrom("target")).toBe(false);
   });

   it("hydrate", async () => {
      // @todo: implement
   });

   it("isListableFor", async () => {
      // by default, the relation is listable from target side
      const relation = new TestEntityRelation();
      expect(relation.isListableFor(relation.target.entity)).toBe(true);
      expect(relation.isListableFor(relation.source.entity)).toBe(false);
   });

   it("required", async () => {
      const relation1 = new TestEntityRelation();
      expect(relation1.required).toBe(false);

      const relation2 = new TestEntityRelation({ required: true });
      expect(relation2.required).toBe(true);
   });
});
