import { afterAll, expect as bunExpect, describe, test } from "bun:test";
import { stripMark } from "core/utils/schema";
import { Entity, EntityManager } from "data/entities";
import { TextField } from "data/fields";
import { PolymorphicRelation } from "data/relations";
import { getDummyConnection } from "./helper";

const { dummyConnection, afterAllCleanup } = getDummyConnection();
afterAll(afterAllCleanup);

const expect = (value: any) => bunExpect(stripMark(value));

describe("Polymorphic", async () => {
   test("Simple", async () => {
      const categories = new Entity("categories", [new TextField("name")]);
      const media = new Entity("media", [new TextField("path")]);

      const entities = [media, categories];
      const relation = new PolymorphicRelation(categories, media, { mappedBy: "image" });

      const em = new EntityManager(entities, dummyConnection, [relation]);

      expect(em.relationsOf(categories.name).map((r) => r.toJSON())[0]).toEqual({
         type: "poly",
         source: "categories",
         target: "media",
         config: {
            mappedBy: "image",
         },
      });
      // media should not see categories
      expect(em.relationsOf(media.name).map((r) => r.toJSON())).toEqual([]);

      // it's important that media cannot access categories
      expect(em.relations.targetRelationsOf(categories).map((r) => r.source.entity.name)).toEqual(
         [],
      );
      expect(em.relations.targetRelationsOf(media).map((r) => r.source.entity.name)).toEqual([]);

      expect(em.relations.sourceRelationsOf(categories).map((r) => r.target.entity.name)).toEqual([
         "media",
      ]);
      expect(em.relations.sourceRelationsOf(categories).map((r) => r.target.reference)).toEqual([
         "image",
      ]);
      expect(em.relations.sourceRelationsOf(media).map((r) => r.target.entity.name)).toEqual([]);

      // expect that polymorphic fields are added to media
      expect(media.getFields().map((f) => f.name)).toEqual([
         "id",
         "path",
         "reference",
         "entity_id",
      ]);
      expect(media.getSelect()).toEqual(["id", "path"]);
   });

   test("Multiple to the same", async () => {
      const categories = new Entity("categories", [new TextField("name")]);
      const media = new Entity("media", [new TextField("path")]);

      const entities = [media, categories];
      const single = new PolymorphicRelation(categories, media, {
         mappedBy: "single",
         targetCardinality: 1,
      });
      const multiple = new PolymorphicRelation(categories, media, { mappedBy: "multiple" });

      const em = new EntityManager(entities, dummyConnection, [single, multiple]);

      // media should not see categories
      expect(em.relationsOf(media.name).map((r) => r.toJSON())).toEqual([]);

      // it's important that media cannot access categories
      expect(em.relations.targetRelationsOf(categories).map((r) => r.source.entity.name)).toEqual(
         [],
      );
      expect(em.relations.targetRelationsOf(media).map((r) => r.source.entity.name)).toEqual([]);

      expect(em.relations.sourceRelationsOf(categories).map((r) => r.target.entity.name)).toEqual([
         "media",
         "media",
      ]);
      expect(em.relations.sourceRelationsOf(categories).map((r) => r.target.reference)).toEqual([
         "single",
         "multiple",
      ]);
      expect(em.relations.sourceRelationsOf(media).map((r) => r.target.entity.name)).toEqual([]);

      // expect that polymorphic fields are added to media
      expect(media.getFields().map((f) => f.name)).toEqual([
         "id",
         "path",
         "reference",
         "entity_id",
      ]);
   });
});
