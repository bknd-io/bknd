import {
   type Static,
   type StaticDecode,
   type TSchema,
   decodeSearch,
   encodeSearch,
   parseDecode,
} from "core/utils";
import { isEqual, transform } from "lodash-es";
import { useLocation, useSearch as useWouterSearch } from "wouter";

// @todo: migrate to Typebox
export function useSearch<Schema extends TSchema = TSchema>(
   schema: Schema,
   defaultValue?: Partial<StaticDecode<Schema>>,
) {
   const searchString = useWouterSearch();
   const [location, navigate] = useLocation();
   let value: StaticDecode<Schema> = defaultValue ? parseDecode(schema, defaultValue as any) : {};

   if (searchString.length > 0) {
      value = parseDecode(schema, decodeSearch(searchString));
      //console.log("search:decode", value);
   }

   // @todo: add option to set multiple keys at once
   function set<Key extends keyof Static<Schema>>(key: Key, value: Static<Schema>[Key]): void {
      //console.log("set", key, value);
      const update = parseDecode(schema, { ...decodeSearch(searchString), [key]: value });
      const search = transform(
         update as any,
         (result, value, key) => {
            if (defaultValue && isEqual(value, defaultValue[key])) return;
            result[key] = value;
         },
         {} as Static<Schema>,
      );
      const encoded = encodeSearch(search, { encode: false });
      navigate(location + (encoded.length > 0 ? "?" + encoded : ""));
   }

   return {
      value: value as Required<StaticDecode<Schema>>,
      set,
   };
}
