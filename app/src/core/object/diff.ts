// biome-ignore lint/suspicious/noConstEnum: <explanation>
export const enum DiffChange {
   Add = "a",
   Remove = "r",
   Edit = "e",
}

type Object = object;
type Primitive = string | number | boolean | null | object | any[] | undefined;

export interface DiffEntry {
   t: DiffChange | string;
   p: (string | number)[];
   o: Primitive;
   n: Primitive;
}

function isObject(value: any): value is Object {
   return value !== null && value.constructor.name === "Object";
}
function isPrimitive(value: any): value is Primitive {
   try {
      return (
         value === null ||
         value === undefined ||
         typeof value === "string" ||
         typeof value === "number" ||
         typeof value === "boolean" ||
         Array.isArray(value) ||
         isObject(value)
      );
   } catch (e) {
      return false;
   }
}

function diff(oldObj: Object, newObj: Object): DiffEntry[] {
   const diffs: DiffEntry[] = [];

   function recurse(oldValue: Primitive, newValue: Primitive, path: (string | number)[]) {
      if (!isPrimitive(oldValue) || !isPrimitive(newValue)) {
         throw new Error("Diff: Only primitive types are supported");
      }

      if (oldValue === newValue) {
         return;
      }

      if (typeof oldValue !== typeof newValue) {
         diffs.push({
            t: DiffChange.Edit,
            p: path,
            o: oldValue,
            n: newValue,
         });
      } else if (Array.isArray(oldValue) && Array.isArray(newValue)) {
         const maxLength = Math.max(oldValue.length, newValue.length);
         for (let i = 0; i < maxLength; i++) {
            if (i >= oldValue.length) {
               diffs.push({
                  t: DiffChange.Add,
                  p: [...path, i],
                  o: undefined,
                  n: newValue[i],
               });
            } else if (i >= newValue.length) {
               diffs.push({
                  t: DiffChange.Remove,
                  p: [...path, i],
                  o: oldValue[i],
                  n: undefined,
               });
            } else {
               recurse(oldValue[i], newValue[i], [...path, i]);
            }
         }
      } else if (isObject(oldValue) && isObject(newValue)) {
         const oKeys = Object.keys(oldValue);
         const nKeys = Object.keys(newValue);
         const allKeys = new Set([...oKeys, ...nKeys]);
         for (const key of allKeys) {
            if (!(key in oldValue)) {
               diffs.push({
                  t: DiffChange.Add,
                  p: [...path, key],
                  o: undefined,
                  n: newValue[key],
               });
            } else if (!(key in newValue)) {
               diffs.push({
                  t: DiffChange.Remove,
                  p: [...path, key],
                  o: oldValue[key],
                  n: undefined,
               });
            } else {
               recurse(oldValue[key], newValue[key], [...path, key]);
            }
         }
      } else {
         diffs.push({
            t: DiffChange.Edit,
            p: path,
            o: oldValue,
            n: newValue,
         });
      }
   }

   recurse(oldObj, newObj, []);
   return diffs;
}

function apply(obj: Object, diffs: DiffEntry[]): any {
   const clonedObj = clone(obj);

   for (const diff of diffs) {
      applyChange(clonedObj, diff);
   }

   return clonedObj;
}

function revert(obj: Object, diffs: DiffEntry[]): any {
   const clonedObj = clone(obj);
   const reversedDiffs = diffs.slice().reverse();

   for (const diff of reversedDiffs) {
      revertChange(clonedObj, diff);
   }

   return clonedObj;
}

function applyChange(obj: Object, diff: DiffEntry) {
   const { p: path, t: type, n: newValue } = diff;
   const parent = getParent(obj, path.slice(0, -1));
   const key = path[path.length - 1]!;

   if (type === DiffChange.Add || type === DiffChange.Edit) {
      parent[key] = newValue;
   } else if (type === DiffChange.Remove) {
      if (Array.isArray(parent)) {
         parent.splice(key as number, 1);
      } else {
         delete parent[key];
      }
   }
}

function revertChange(obj: Object, diff: DiffEntry) {
   const { p: path, t: type, o: oldValue } = diff;
   const parent = getParent(obj, path.slice(0, -1));
   const key = path[path.length - 1]!;

   if (type === DiffChange.Add) {
      if (Array.isArray(parent)) {
         parent.splice(key as number, 1);
      } else {
         delete parent[key];
      }
   } else if (type === DiffChange.Remove || type === DiffChange.Edit) {
      parent[key] = oldValue;
   }
}

function getParent(obj: Object, path: (string | number)[]): any {
   let current = obj;
   for (const key of path) {
      if (current[key] === undefined) {
         current[key] = typeof key === "number" ? [] : {};
      }
      current = current[key];
   }
   return current;
}

function clone<In extends Object>(obj: In): In {
   return JSON.parse(JSON.stringify(obj));
}

export { diff, apply, revert, clone };
