import { inspect } from "node:util";

export type BindingTypeMap = {
   D1Database: D1Database;
   KVNamespace: KVNamespace;
   DurableObjectNamespace: DurableObjectNamespace;
   R2Bucket: R2Bucket;
};

export type GetBindingType = keyof BindingTypeMap;
export type BindingMap<T extends GetBindingType> = { key: string; value: BindingTypeMap[T] };

export function getBindings<T extends GetBindingType>(env: any, type: T): BindingMap<T>[] {
   const bindings: BindingMap<T>[] = [];
   for (const key in env) {
      try {
         if (
            (env[key] as any).constructor.name === type ||
            String(env[key]) === `[object ${type}]` ||
            inspect(env[key]).includes(type)
         ) {
            bindings.push({
               key,
               value: env[key] as BindingTypeMap[T],
            });
         }
      } catch (e) {}
   }
   return bindings;
}

export function getBinding<T extends GetBindingType>(env: any, type: T): BindingMap<T> {
   const bindings = getBindings(env, type);
   if (bindings.length === 0) {
      throw new Error(`No ${type} found in bindings`);
   }
   return bindings[0] as BindingMap<T>;
}
