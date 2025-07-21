import type { FormEvent } from "react";

export type InputElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export function ignoreTarget(target: InputElement | Element | null, form?: HTMLFormElement) {
   const tagName = target?.tagName.toLowerCase() ?? "";
   const tagNames = ["input", "select", "textarea"];

   return (
      !target ||
      !form?.contains(target) ||
      !tagNames.includes(tagName) ||
      !("name" in target) ||
      target.hasAttribute("data-ignore") ||
      target.closest("[data-ignore]")
   );
}

export function getFormTarget(e: FormEvent<HTMLFormElement>): InputElement | null {
   const form = e.currentTarget;
   const target = e.target as InputElement | null;

   return ignoreTarget(target, form) ? null : target;
}

export function getTargetsByName(form: HTMLFormElement, name: string): InputElement[] {
   const query = form.querySelectorAll(`[name="${name}"]`);
   return Array.from(query).filter((e) => ignoreTarget(e)) as InputElement[];
}

export function coerce(target: InputElement | null, value?: any) {
   if (!target) return value;
   const required = target.required;
   if (!value && !required) return undefined;

   if (target.type === "number") {
      const num = Number(value);
      if (Number.isNaN(num) && !required) return undefined;

      const min = "min" in target && target.min.length > 0 ? Number(target.min) : undefined;
      const max = "max" in target && target.max.length > 0 ? Number(target.max) : undefined;
      const step = "step" in target && target.step.length > 0 ? Number(target.step) : undefined;

      if (min && num < min) return min;
      if (max && num > max) return max;
      if (step && step !== 1) return Math.round(num / step) * step;

      return num;
   } else if (target.type === "text") {
      const maxLength =
         "maxLength" in target && target.maxLength > -1 ? Number(target.maxLength) : undefined;
      const pattern = "pattern" in target ? /target.pattern/g : undefined;

      if (maxLength && value.length > maxLength) return value.slice(0, maxLength);
      if (pattern && !pattern.test(value)) return "";

      return value;
   } else if (target.type === "checkbox") {
      if ("checked" in target) return !!target.checked;
      return ["on", "1", "true", 1, true].includes(value);
   } else {
      return value;
   }
}

export type CleanOptions = {
   empty?: any[];
   emptyInArray?: any[];
   keepEmptyArray?: boolean;
};
export function cleanObject<Obj extends { [key: string]: any }>(
   obj: Obj,
   _opts?: CleanOptions,
): Obj {
   if (!obj) return obj;
   const _empty = [null, undefined, ""];
   const opts = {
      empty: _opts?.empty ?? _empty,
      emptyInArray: _opts?.emptyInArray ?? _empty,
      keepEmptyArray: _opts?.keepEmptyArray ?? false,
   };

   return Object.entries(obj).reduce((acc, [key, value]) => {
      if (value && Array.isArray(value) && value.some((v) => typeof v === "object")) {
         const nested = value.map((o) => cleanObject(o, opts));
         if (nested.length > 0 || opts?.keepEmptyArray) {
            acc[key] = nested;
         }
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
         const nested = cleanObject(value, opts);
         if (Object.keys(nested).length > 0) {
            acc[key] = nested;
         }
      } else if (Array.isArray(value)) {
         const nested = value.filter((v) => !opts.emptyInArray.includes(v));
         if (nested.length > 0 || opts?.keepEmptyArray) {
            acc[key] = nested;
         }
      } else if (!opts.empty.includes(value)) {
         acc[key] = value;
      }
      return acc;
   }, {} as any);
}

export function setPath(object, _path, value) {
   let path = _path;

   // Optional string-path support.
   // You can remove this `if` block if you don't need it.
   if (typeof path === "string") {
      const isQuoted = (str) => str[0] === '"' && str.at(-1) === '"';
      path = path
         .split(/[.\[\]]+/)
         .filter((x) => x)
         .map((x) => (!Number.isNaN(Number(x)) ? Number(x) : x))
         .map((x) => (typeof x === "string" && isQuoted(x) ? x.slice(1, -1) : x));
   }

   if (path.length === 0) {
      throw new Error("The path must have at least one entry in it");
   }

   const [head, ...tail] = path;

   if (tail.length === 0) {
      object[head] = value;
      return object;
   }

   if (!(head in object)) {
      object[head] = typeof tail[0] === "number" ? [] : {};
   }

   setPath(object[head], tail, value);
   return object;
}
