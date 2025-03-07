import { expect, test } from "bun:test";
import type { ColumnDataType } from "kysely";
import { omit } from "lodash-es";
import type { BaseFieldConfig, Field, TActionContext } from "../../../../src/data";

type ConstructableField = new (name: string, config?: Partial<BaseFieldConfig>) => Field;

type FieldTestConfig = {
   defaultValue: any;
   sampleValues?: any[];
   schemaType: ColumnDataType;
};

export function transformPersist(field: Field, value: any, context?: TActionContext) {
   return field.transformPersist(value, undefined as any, context as any);
}

export function runBaseFieldTests(
   fieldClass: ConstructableField,
   config: FieldTestConfig,
   _requiredConfig: any = {},
) {
   const noConfigField = new fieldClass("no_config", _requiredConfig);
   const fillable = new fieldClass("fillable", { ..._requiredConfig, fillable: true });
   const required = new fieldClass("required", { ..._requiredConfig, required: true });
   const hidden = new fieldClass("hidden", { ..._requiredConfig, hidden: true });
   const dflt = new fieldClass("dflt", { ..._requiredConfig, default_value: config.defaultValue });
   const requiredAndDefault = new fieldClass("full", {
      ..._requiredConfig,
      fillable: true,
      required: true,
      default_value: config.defaultValue,
   });

   test("schema", () => {
      expect(noConfigField.name).toBe("no_config");

      const { type, name, nullable, dflt } = noConfigField.schema()!;
      expect({ type, name, nullable, dflt }).toEqual({
         type: config.schemaType as any,
         name: "no_config",
         nullable: true, // always true
         dflt: undefined, // never using default value
      });
   });

   test("hasDefault", async () => {
      expect(noConfigField.hasDefault()).toBe(false);
      expect(noConfigField.getDefault()).toBeUndefined();
      expect(dflt.hasDefault()).toBe(true);
      expect(dflt.getDefault()).toBe(config.defaultValue);
   });

   test("isFillable", async () => {
      expect(noConfigField.isFillable()).toBe(true);
      expect(fillable.isFillable()).toBe(true);
      expect(hidden.isFillable()).toBe(true);
      expect(required.isFillable()).toBe(true);
   });

   test("isHidden", async () => {
      expect(noConfigField.isHidden()).toBe(false);
      expect(hidden.isHidden()).toBe(true);
      expect(fillable.isHidden()).toBe(false);
      expect(required.isHidden()).toBe(false);
   });

   test("isRequired", async () => {
      expect(noConfigField.isRequired()).toBe(false);
      expect(required.isRequired()).toBe(true);
      expect(hidden.isRequired()).toBe(false);
      expect(fillable.isRequired()).toBe(false);
   });

   test.if(Array.isArray(config.sampleValues))("getValue (RenderContext)", async () => {
      const isPrimitive = (v) => ["string", "number"].includes(typeof v);
      for (const value of config.sampleValues!) {
         // "form"
         expect(isPrimitive(noConfigField.getValue(value, "form"))).toBeTrue();
         // "table"
         expect(isPrimitive(noConfigField.getValue(value, "table"))).toBeTrue();
         // "read"
         // "submit"
      }
   });

   test("transformPersist", async () => {
      const persist = await transformPersist(noConfigField, config.defaultValue);
      expect(config.defaultValue).toEqual(noConfigField.transformRetrieve(config.defaultValue));
      expect(transformPersist(noConfigField, null)).resolves.toBeUndefined();
      expect(transformPersist(noConfigField, undefined)).resolves.toBeUndefined();
      expect(transformPersist(requiredAndDefault, null)).resolves.toBe(persist);
      expect(transformPersist(dflt, null)).resolves.toBe(persist);
   });

   test("toJSON", async () => {
      const _config = {
         ..._requiredConfig,
         //order: 1,
         fillable: true,
         required: false,
         hidden: false,
         //virtual: false,
         //default_value: undefined
      };

      function fieldJson(field: Field) {
         const json = field.toJSON();
         return {
            ...json,
            config: omit(json.config, ["html"]),
         };
      }

      expect(fieldJson(noConfigField)).toEqual({
         //name: "no_config",
         type: noConfigField.type,
         config: _config,
      });

      expect(fieldJson(fillable)).toEqual({
         //name: "fillable",
         type: noConfigField.type,
         config: _config,
      });

      expect(fieldJson(required)).toEqual({
         //name: "required",
         type: required.type,
         config: {
            ..._config,
            required: true,
         },
      });

      expect(fieldJson(hidden)).toEqual({
         //name: "hidden",
         type: required.type,
         config: {
            ..._config,
            hidden: true,
         },
      });

      expect(fieldJson(dflt)).toEqual({
         //name: "dflt",
         type: dflt.type,
         config: {
            ..._config,
            default_value: config.defaultValue,
         },
      });

      expect(fieldJson(requiredAndDefault)).toEqual({
         //name: "full",
         type: requiredAndDefault.type,
         config: {
            ..._config,
            fillable: true,
            required: true,
            default_value: config.defaultValue,
         },
      });
   });
}
