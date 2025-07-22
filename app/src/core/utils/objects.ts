import { pascalToKebab } from "./strings";

export function _jsonp(obj: any, space = 2): string {
   return JSON.stringify(obj, null, space);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
   return Object.prototype.toString.call(value) === "[object Object]";
}

export function isObject(value: unknown): value is Record<string, unknown> {
   return value !== null && typeof value === "object";
}

export function omitKeys<T extends object, K extends keyof T>(
   obj: T,
   keys_: readonly K[],
): Omit<T, Extract<K, keyof T>> {
   const keys = new Set(keys_);
   const result = {} as Omit<T, Extract<K, keyof T>>;
   for (const [key, value] of Object.entries(obj) as [keyof T, T[keyof T]][]) {
      if (!keys.has(key as K)) {
         (result as any)[key] = value;
      }
   }
   return result;
}

export function safelyParseObjectValues<T extends { [key: string]: any }>(obj: T): T {
   return Object.entries(obj).reduce((acc, [key, value]) => {
      try {
         // @ts-ignore
         acc[key] = JSON.parse(value);
      } catch (error) {
         // @ts-ignore
         acc[key] = value;
      }
      return acc;
   }, {} as T);
}

export function keepChanged<T extends object>(origin: T, updated: T): Partial<T> {
   return Object.keys(updated).reduce(
      (acc, key) => {
         if (updated[key] !== origin[key]) {
            acc[key] = updated[key];
         }
         return acc;
      },
      {} as Partial<T>,
   );
}

export function objectKeysPascalToKebab(obj: any, ignoreKeys: string[] = []): any {
   if (obj === null || typeof obj !== "object") {
      return obj;
   }

   if (Array.isArray(obj)) {
      return obj.map((item) => objectKeysPascalToKebab(item, ignoreKeys));
   }

   return Object.keys(obj).reduce(
      (acc, key) => {
         const kebabKey = ignoreKeys.includes(key) ? key : pascalToKebab(key);
         acc[kebabKey] = objectKeysPascalToKebab(obj[key], ignoreKeys);
         return acc;
      },
      {} as Record<string, any>,
   );
}

export function filterKeys<Object extends { [key: string]: any }>(
   obj: Object,
   keysToFilter: string[],
): Object {
   const result = {} as Object;

   for (const key in obj) {
      const shouldFilter = keysToFilter.some((filterKey) => key.includes(filterKey));
      if (!shouldFilter) {
         if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
            result[key] = filterKeys(obj[key], keysToFilter);
         } else {
            result[key] = obj[key];
         }
      }
   }

   return result;
}

export function transformObject<T extends Record<string, any>, U>(
   object: T,
   transform: (value: T[keyof T], key: keyof T) => U | undefined,
): { [K in keyof T]: U } {
   const result = {} as { [K in keyof T]: U };
   for (const [key, value] of Object.entries(object) as [keyof T, T[keyof T]][]) {
      const t = transform(value, key);
      if (typeof t !== "undefined") {
         result[key] = t;
      }
   }
   return result;
}
export const objectTransform = transformObject;

export function objectEach<T extends Record<string, any>, U>(
   object: T,
   each: (value: T[keyof T], key: keyof T) => U,
): void {
   Object.entries(object).forEach(
      ([key, value]) => {
         each(value, key);
      },
      {} as { [K in keyof T]: U },
   );
}

/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
export function mergeDeep(target, ...sources) {
   if (!sources.length) return target;
   const source = sources.shift();

   if (isObject(target) && isObject(source)) {
      for (const key in source) {
         if (isObject(source[key])) {
            if (!target[key]) Object.assign(target, { [key]: {} });
            mergeDeep(target[key], source[key]);
         } else {
            Object.assign(target, { [key]: source[key] });
         }
      }
   }

   return mergeDeep(target, ...sources);
}

export function getFullPathKeys(obj: any, parentPath: string = ""): string[] {
   let keys: string[] = [];

   for (const key in obj) {
      const fullPath = parentPath ? `${parentPath}.${key}` : key;
      keys.push(fullPath);

      if (typeof obj[key] === "object" && obj[key] !== null) {
         keys = keys.concat(getFullPathKeys(obj[key], fullPath));
      }
   }

   return keys;
}

export function flattenObject(obj: any, parentKey = "", result: any = {}): any {
   for (const key in obj) {
      if (key in obj) {
         const newKey = parentKey ? `${parentKey}.${key}` : key;
         if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
            flattenObject(obj[key], newKey, result);
         } else if (Array.isArray(obj[key])) {
            obj[key].forEach((item, index) => {
               const arrayKey = `${newKey}.${index}`;
               if (typeof item === "object" && item !== null) {
                  flattenObject(item, arrayKey, result);
               } else {
                  result[arrayKey] = item;
               }
            });
         } else {
            result[newKey] = obj[key];
         }
      }
   }
   return result;
}

export function objectDepth(object: object): number {
   let level = 1;
   for (const key in object) {
      if (typeof object[key] === "object") {
         const depth = objectDepth(object[key]) + 1;
         level = Math.max(depth, level);
      }
   }
   return level;
}

export function objectCleanEmpty<Obj extends { [key: string]: any }>(obj: Obj): Obj {
   if (!obj) return obj;
   return Object.entries(obj).reduce((acc, [key, value]) => {
      if (value && Array.isArray(value) && value.some((v) => typeof v === "object")) {
         const nested = value.map(objectCleanEmpty);
         if (nested.length > 0) {
            acc[key] = nested;
         }
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
         const nested = objectCleanEmpty(value);
         if (Object.keys(nested).length > 0) {
            acc[key] = nested;
         }
      } else if (value !== "" && value !== null && value !== undefined) {
         acc[key] = value;
      }
      return acc;
   }, {} as any);
}

/**
 * Lodash's merge implementation caused issues in Next.js environments
 * From: https://thescottyjam.github.io/snap.js/#!/nolodash/merge
 * NOTE: This mutates `object`. It also may mutate anything that gets attached to `object` during the merge.
 * @param object
 * @param sources
 */
export function mergeObject(object, ...sources) {
   for (const source of sources) {
      for (const [key, value] of Object.entries(source)) {
         if (value === undefined) {
            continue;
         }

         // These checks are a week attempt at mimicking the various edge-case behaviors
         // that Lodash's `_.merge()` exhibits. Feel free to simplify and
         // remove checks that you don't need.
         if (!isPlainObject(value) && !Array.isArray(value)) {
            object[key] = value;
         } else if (Array.isArray(value) && !Array.isArray(object[key])) {
            object[key] = value;
         } else if (!isObject(object[key])) {
            object[key] = value;
         } else {
            mergeObject(object[key], value);
         }
      }
   }

   return object;
}

/**
 * Lodash's mergeWith implementation caused issues in Next.js environments
 * From: https://thescottyjam.github.io/snap.js/#!/nolodash/mergeWith
 * NOTE: This mutates `object`. It also may mutate anything that gets attached to `object` during the merge.
 * @param object
 * @param sources
 * @param customizer
 */
export function mergeObjectWith(object, source, customizer) {
   for (const [key, value] of Object.entries(source)) {
      const mergedValue = customizer(object[key], value, key, object, source);
      if (mergedValue !== undefined) {
         object[key] = mergedValue;
         continue;
      }
      // Otherwise, fall back to default behavior

      if (value === undefined) {
         continue;
      }

      // These checks are a week attempt at mimicking the various edge-case behaviors
      // that Lodash's `_.merge()` exhibits. Feel free to simplify and
      // remove checks that you don't need.
      if (!isPlainObject(value) && !Array.isArray(value)) {
         object[key] = value;
      } else if (Array.isArray(value) && !Array.isArray(object[key])) {
         object[key] = value;
      } else if (!isObject(object[key])) {
         object[key] = value;
      } else {
         mergeObjectWith(object[key], value, customizer);
      }
   }

   return object;
}

export function isEqual(value1: any, value2: any): boolean {
   // Each type corresponds to a particular comparison algorithm
   const getType = (value: any) => {
      if (value !== Object(value)) return "primitive";
      if (Array.isArray(value)) return "array";
      if (value instanceof Map) return "map";
      if (value != null && [null, Object.prototype].includes(Object.getPrototypeOf(value)))
         return "plainObject";
      if (value instanceof Function) return "function";
      throw new Error(
         `deeply comparing an instance of type ${value1.constructor?.name} is not supported.`,
      );
   };

   const type = getType(value1);
   if (type !== getType(value2)) {
      return false;
   }

   if (type === "primitive") {
      return value1 === value2 || (Number.isNaN(value1) && Number.isNaN(value2));
   } else if (type === "array") {
      return (
         value1.length === value2.length &&
         value1.every((iterValue: any, i: number) => isEqual(iterValue, value2[i]))
      );
   } else if (type === "map") {
      // In this particular implementation, map keys are not
      // being deeply compared, only map values.
      return (
         value1.size === value2.size &&
         [...value1].every(([iterKey, iterValue]) => {
            return value2.has(iterKey) && isEqual(iterValue, value2.get(iterKey));
         })
      );
   } else if (type === "plainObject") {
      const value1AsMap = new Map(Object.entries(value1));
      const value2AsMap = new Map(Object.entries(value2));
      return (
         value1AsMap.size === value2AsMap.size &&
         [...value1AsMap].every(([iterKey, iterValue]) => {
            return value2AsMap.has(iterKey) && isEqual(iterValue, value2AsMap.get(iterKey));
         })
      );
   } else if (type === "function") {
      // just check signature
      return value1.toString() === value2.toString();
   } else {
      throw new Error("Unreachable");
   }
}

export function getPath(
   object: object,
   _path: string | (string | number)[],
   defaultValue = undefined,
): any {
   const path = typeof _path === "string" ? _path.split(/[.\[\]\"]+/).filter((x) => x) : _path;

   if (path.length === 0) {
      return object;
   }

   try {
      const [head, ...tail] = path;
      if (!head || !(head in object)) {
         return defaultValue;
      }

      return getPath(object[head], tail, defaultValue);
   } catch (error) {
      if (typeof defaultValue !== "undefined") {
         return defaultValue;
      }

      throw new Error(`Invalid path: ${path.join(".")}`);
   }
}

export function objectToJsLiteral(value: object, indent: number = 0, _level: number = 0): string {
   const nl = indent ? "\n" : "";
   const pad = (lvl: number) => (indent ? " ".repeat(indent * lvl) : "");
   const openPad = pad(_level + 1);
   const closePad = pad(_level);

   // primitives
   if (value === null) return "null";
   if (value === undefined) return "undefined";
   const t = typeof value;
   if (t === "string") return JSON.stringify(value); // handles escapes
   if (t === "number" || t === "boolean") return String(value);

   // arrays
   if (Array.isArray(value)) {
      const out = value
         .map((v) => objectToJsLiteral(v, indent, _level + 1))
         .join(", " + (indent ? nl + openPad : ""));
      return (
         "[" +
         (indent && value.length ? nl + openPad : "") +
         out +
         (indent && value.length ? nl + closePad : "") +
         "]"
      );
   }

   // objects
   if (t === "object") {
      const entries = Object.entries(value).map(([k, v]) => {
         const idOk = /^[A-Za-z_$][\w$]*$/.test(k); // valid identifier?
         const key = idOk ? k : JSON.stringify(k); // quote if needed
         return key + ": " + objectToJsLiteral(v, indent, _level + 1);
      });
      const out = entries.join(", " + (indent ? nl + openPad : ""));
      return (
         "{" +
         (indent && entries.length ? nl + openPad : "") +
         out +
         (indent && entries.length ? nl + closePad : "") +
         "}"
      );
   }

   throw new TypeError(`Unsupported data type: ${t}`);
}

// lodash-es compatible `pick` with perfect type inference
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
   return keys.reduce(
      (acc, key) => {
         if (key in obj) {
            acc[key] = obj[key];
         }
         return acc;
      },
      {} as Pick<T, K>,
   );
}

export function deepFreeze<T extends object>(object: T): T {
   if (Object.isFrozen(object)) return object;

   // Retrieve the property names defined on object
   const propNames = Reflect.ownKeys(object);

   // Freeze properties before freezing self
   for (const name of propNames) {
      const value = object[name];

      if ((value && typeof value === "object") || typeof value === "function") {
         deepFreeze(value);
      }
   }

   return Object.freeze(object);
}
