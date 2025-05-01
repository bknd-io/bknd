import type { StaticDecode, TSchema } from "@sinclair/typebox";
import { BkndError, SimpleRenderer } from "core";
import { type Static, type TObject, Value, parse, ucFirst } from "core/utils";
import type { InputsMap } from "../flows/Execution";
import * as tbbox from "@sinclair/typebox";
const { Type } = tbbox;
//type InstanceOf<T> = T extends new (...args: any) => infer R ? R : never;

export type TaskResult<Output = any> = {
   start: Date;
   output?: Output;
   error?: any;
   success: boolean;
   params: any;
};

export type TaskRenderProps<T extends Task = Task> = any;

export function dynamic<Type extends TSchema>(
   type: Type,
   parse?: (val: any | string) => Static<Type>,
) {
   const guessDecode = (val: unknown): Static<Type> => {
      if (typeof val === "string") {
         switch (type.type) {
            case "object":
            case "array":
               return JSON.parse(val);
            case "number":
               return Number.parseInt(val);
            case "boolean":
               return val === "true" || val === "1";
         }
      }

      return val as Static<Type>;
   };

   const decode = (val: unknown): Static<Type> => {
      if (typeof val === "string") {
         return parse ? parse(val) : guessDecode(val);
      }

      return val as Static<Type>;
   };
   const title = (type.title ?? type.type) ? ucFirst(type.type) : "Raw";

   return (
      Type.Transform(Type.Union([{ title, ...type }, Type.String({ title: "Template" })]))
         .Decode(decode)
         // @ts-ignore
         .Encode((val) => val)
   );
}

export abstract class Task<Params extends TObject = TObject, Output = unknown> {
   abstract type: string;
   name: string;

   /**
    * The schema of the task's parameters.
    */
   static schema = Type.Object({});

   /**
    * The task's parameters.
    */
   _params: Static<Params>;

   constructor(name: string, params?: Static<Params>) {
      if (typeof name !== "string") {
         throw new Error(`Task name must be a string, got ${typeof name}`);
      }

      // @todo: should name be easier for object access?

      this.name = name;

      const schema = (this.constructor as typeof Task).schema;

      if (
         schema === Task.schema &&
         typeof params !== "undefined" &&
         Object.keys(params).length > 0
      ) {
         throw new Error(
            `Task "${name}" has no schema defined but params passed: ${JSON.stringify(params)}`,
         );
      }

      // @todo: string enums fail to validate
      this._params = parse(schema, params || {});
   }

   get params() {
      return this._params as StaticDecode<Params>;
   }

   protected clone(name: string, params: Static<Params>): Task {
      return new (this.constructor as any)(name, params);
   }

   static async resolveParams<S extends TSchema>(
      schema: S,
      params: any,
      inputs: object = {},
   ): Promise<StaticDecode<S>> {
      const newParams: any = {};
      const renderer = new SimpleRenderer(inputs, { renderKeys: true });

      for (const [key, value] of Object.entries(params)) {
         if (value && SimpleRenderer.hasMarkup(value)) {
            try {
               newParams[key] = await renderer.render(value as string);
            } catch (e: any) {
               // wrap in bknd error for better error display
               if (!(e instanceof BkndError)) {
                  throw new BkndError(
                     "Failed to resolve param",
                     {
                        key,
                        value,
                        error: e.message,
                     },
                     "resolve-params",
                  );
               }

               throw e;
            }
            continue;
         }

         newParams[key] = value;
      }

      return Value.Decode(schema, newParams);
   }

   private async cloneWithResolvedParams(_inputs: Map<string, any>) {
      const inputs = Object.fromEntries(_inputs.entries());
      const newParams = await Task.resolveParams(
         (this.constructor as any).schema,
         this._params,
         inputs,
      );

      return this.clone(this.name, newParams as any);
   }

   /**
    * The internal execution of the flow.
    * Wraps the execute() function to gather log results.
    */
   async run(inputs: InputsMap = new Map()) {
      const start = new Date();
      let output: Output | undefined;
      let error: any;
      let success: boolean;
      let params: any;
      let time: number;

      const starttime = performance.now();

      try {
         // create a copy with resolved params
         const newTask = await this.cloneWithResolvedParams(inputs);
         params = newTask.params;

         output = (await newTask.execute(inputs)) as any;
         success = true;
      } catch (e: any) {
         success = false;

         if (e instanceof BkndError) {
            error = e.toJSON();
         } else {
            error = {
               type: "unknown",
               message: (e as any).message,
            };
         }
      }

      return { start, output, error, success, params, time: performance.now() - starttime };
   }

   protected error(message: string, details?: Record<string, any>) {
      return new BkndError(message, details, "runtime");
   }

   abstract execute(inputs: Map<string, any>): Promise<Output>;

   // that's for react flow's default node
   get label() {
      return this.name;
   }

   toJSON() {
      return {
         type: this.type,
         params: this.params,
      };
   }
}
