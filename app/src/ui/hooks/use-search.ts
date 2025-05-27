import { decodeSearch, encodeSearch, parseDecode } from "core/utils";
import { isEqual, transform } from "lodash-es";
import { useLocation, useSearch as useWouterSearch } from "wouter";
import { type s, parse } from "core/object/schema";

// @todo: migrate to Typebox
export function useSearch<Schema extends s.TAnySchema = s.TAnySchema>(
   schema: Schema,
   defaultValue?: Partial<s.StaticCoerced<Schema>>,
) {
   const searchString = useWouterSearch();
   const [location, navigate] = useLocation();
   const initial = searchString.length > 0 ? decodeSearch(searchString) : (defaultValue ?? {});
   const value = parse(schema, initial, {
      withDefaults: true,
      clone: true,
   }) as s.StaticCoerced<Schema>;

   // @todo: add option to set multiple keys at once
   function set<Key extends keyof s.StaticCoerced<Schema>>(
      key: Key,
      value: s.StaticCoerced<Schema>[Key],
   ): void {
      //console.log("set", key, value);
      const update = parse(schema, { ...decodeSearch(searchString), [key]: value });
      const search = transform(
         update as any,
         (result, value, key) => {
            if (defaultValue && isEqual(value, defaultValue[key])) return;
            result[key] = value;
         },
         {} as s.StaticCoerced<Schema>,
      );
      const encoded = encodeSearch(search, { encode: false });
      navigate(location + (encoded.length > 0 ? "?" + encoded : ""));
   }

   return {
      value: value as Required<s.StaticCoerced<Schema>>,
      set,
   };
}
