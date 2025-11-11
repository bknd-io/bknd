export type BindingTypeMap = {
   D1Database: D1Database;
   KVNamespace: KVNamespace;
   DurableObjectNamespace: DurableObjectNamespace;
   R2Bucket: R2Bucket;
};

export type GetBindingType = keyof BindingTypeMap;
export type BindingMap<T extends GetBindingType> = { key: string; value: BindingTypeMap[T] };

export const bindingMatchers = {
   // D1Database instance doesn't stringify to [object D1Database] (yet)
   D1Database: (value: object): value is D1Database => {
      if (typeof value !== "object" || value === null) return false;
      if (String(value) === "[object D1Database]") return true;
      if (Object.keys(value).length !== 2) return false;
      return ["alwaysPrimarySession", "fetcher"].every((key) => key in value);
   },
   KVNamespace: (value: object): value is KVNamespace =>
      String(value) === "[object KvNamespace]" && Object.keys(value).length === 0,
   DurableObjectNamespace: (value: object): value is DurableObjectNamespace =>
      String(value) === "[object DurableObjectNamespace]" && Object.keys(value).length === 0,
   R2Bucket: (value: object): value is R2Bucket =>
      String(value) === "[object R2Bucket]" && Object.keys(value).length === 0,
};

export function getBindings<T extends GetBindingType>(env: any, type: T): BindingMap<T>[] {
   const bindings: BindingMap<T>[] = [];
   if (!(type in bindingMatchers)) {
      console.error(`No binding matcher for type ${type}`);
      return [];
   }

   const matcher = bindingMatchers[type];

   for (const key in env) {
      const value = env[key];
      if (typeof value !== "object" || value === null) continue;
      if (!matcher(value)) continue;

      bindings.push({
         key,
         value,
      } as any);
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
