import { get, has, omit, set } from "lodash-es";
import { type s, parse, stripMark, getFullPathKeys, mergeObjectWith, deepFreeze } from "bknd/utils";

export type SchemaObjectOptions<Schema extends s.Schema> = {
   onUpdate?: (config: s.Static<Schema>) => void | Promise<void>;
   onBeforeUpdate?: (
      from: s.Static<Schema>,
      to: s.Static<Schema>,
   ) => s.Static<Schema> | Promise<s.Static<Schema>>;
   restrictPaths?: string[];
   overwritePaths?: (RegExp | string)[];
   forceParse?: boolean;
};

type TSchema = s.ObjectSchema<any>;

export class SchemaObject<Schema extends TSchema = TSchema> {
   private readonly _default: Partial<s.Static<Schema>>;
   private _value: s.Static<Schema>;
   private _config: s.Static<Schema>;
   private _restriction_bypass: boolean = false;

   constructor(
      private _schema: Schema,
      initial?: Partial<s.Static<Schema>>,
      private options?: SchemaObjectOptions<Schema>,
   ) {
      this._default = deepFreeze(_schema.template({}, { withOptional: true }) as any);
      this._value = deepFreeze(
         parse(_schema, structuredClone(initial ?? {}), {
            withDefaults: true,
            //withExtendedDefaults: true,
            forceParse: this.isForceParse(),
            skipMark: this.isForceParse(),
         }),
      );
      this._config = deepFreeze(this._value);
   }

   protected isForceParse(): boolean {
      return this.options?.forceParse ?? true;
   }

   default() {
      return this._default;
   }

   private async onBeforeUpdate(
      from: s.Static<Schema>,
      to: s.Static<Schema>,
   ): Promise<s.Static<Schema>> {
      if (this.options?.onBeforeUpdate) {
         return this.options.onBeforeUpdate(from, to);
      }
      return to;
   }

   get(options?: { stripMark?: boolean }): s.Static<Schema> {
      if (options?.stripMark) {
         return stripMark(this._config);
      }

      return this._config;
   }

   clone() {
      return structuredClone(this._config);
   }

   async set(config: s.Static<Schema>, noEmit?: boolean): Promise<s.Static<Schema>> {
      const valid = parse(this._schema, structuredClone(config) as any, {
         coerce: false,
         forceParse: true,
         skipMark: this.isForceParse(),
      });

      // regardless of "noEmit" – this should always be triggered
      const updatedConfig = await this.onBeforeUpdate(this._config, valid);

      this._value = deepFreeze(updatedConfig);
      this._config = deepFreeze(updatedConfig);

      if (noEmit !== true) {
         await this.options?.onUpdate?.(this._config);
      }

      return this._config;
   }

   bypass() {
      this._restriction_bypass = true;
      return this;
   }

   throwIfRestricted(object: object): void;
   throwIfRestricted(path: string): void;
   throwIfRestricted(pathOrObject: string | object): void {
      // only bypass once
      if (this._restriction_bypass) {
         this._restriction_bypass = false;
         return;
      }

      const paths = this.options?.restrictPaths ?? [];
      if (Array.isArray(paths) && paths.length > 0) {
         for (const path of paths) {
            const restricted =
               typeof pathOrObject === "string"
                  ? pathOrObject.startsWith(path)
                  : has(pathOrObject, path);

            if (restricted) {
               throw new Error(`Path "${path}" is restricted`);
            }
         }
      }

      return;
   }

   async patch(path: string, value: any): Promise<[Partial<s.Static<Schema>>, s.Static<Schema>]> {
      const current = this.clone();
      const partial = path.length > 0 ? (set({}, path, value) as Partial<s.Static<Schema>>) : value;

      this.throwIfRestricted(partial);

      // overwrite arrays and primitives, only deep merge objects
      // @ts-ignore
      const config = mergeObjectWith(current, partial, (objValue, srcValue) => {
         if (Array.isArray(objValue) && Array.isArray(srcValue)) {
            return srcValue;
         }
      });

      if (this.options?.overwritePaths) {
         const keys = getFullPathKeys(value).map((k) => {
            // only prepend path if given
            return path.length > 0 ? path + "." + k : k;
         });
         const overwritePaths = keys.filter((k) => {
            return this.options?.overwritePaths?.some((p) => {
               if (typeof p === "string") {
                  return k === p;
               } else {
                  return p.test(k);
               }
            });
         });

         if (overwritePaths.length > 0) {
            // filter out less specific paths (but only if more than 1)
            const specific =
               overwritePaths.length > 1
                  ? overwritePaths.filter((k) =>
                       overwritePaths.some((k2) => {
                          return k2 !== k && k2.startsWith(k);
                       }),
                    )
                  : overwritePaths;

            for (const p of specific) {
               set(config, p, get(partial, p));
            }
         }
      }

      const newConfig = await this.set(config);
      return [partial, newConfig];
   }

   async overwrite(
      path: string,
      value: any,
   ): Promise<[Partial<s.Static<Schema>>, s.Static<Schema>]> {
      const current = this.clone();
      const partial = path.length > 0 ? (set({}, path, value) as Partial<s.Static<Schema>>) : value;

      this.throwIfRestricted(partial);

      // overwrite arrays and primitives, only deep merge objects
      // @ts-ignore
      const config = set(current, path, value);

      const newConfig = await this.set(config);
      return [partial, newConfig];
   }

   has(path: string): boolean {
      const p = path.split(".");
      if (p.length > 1) {
         const parent = p.slice(0, -1).join(".");
         if (!has(this._config, parent)) {
            throw new Error(`Parent path "${parent}" does not exist`);
         }
      }

      return has(this._config, path);
   }

   async remove(path: string): Promise<[Partial<s.Static<Schema>>, s.Static<Schema>]> {
      this.throwIfRestricted(path);

      if (!this.has(path)) {
         throw new Error(`Path "${path}" does not exist`);
      }

      const current = this.clone();
      const removed = get(current, path) as Partial<s.Static<Schema>>;
      const config = omit(current, path);
      const newConfig = await this.set(config as any);
      return [removed, newConfig];
   }
}
