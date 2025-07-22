import { decodeSearch, encodeSearch, mergeObject, type s, parse } from "bknd/utils";
import { isEqual, transform } from "lodash-es";
import { useLocation, useSearch as useWouterSearch } from "wouter";
import { useEffect, useMemo, useState } from "react";

export type UseSearchOptions<Schema extends s.Schema = s.Schema> = {
   defaultValue?: Partial<s.StaticCoerced<Schema>>;
   beforeEncode?: (search: Partial<s.StaticCoerced<Schema>>) => object;
};

export function useSearch<Schema extends s.Schema = s.Schema>(
   schema: Schema,
   options?: UseSearchOptions<Schema>,
) {
   const searchString = useWouterSearch();
   const [location, navigate] = useLocation();
   const [value, setValue] = useState<s.StaticCoerced<Schema>>(
      options?.defaultValue ?? ({} as any),
   );

   const defaults = useMemo(() => {
      return mergeObject(
         // @ts-ignore
         schema.template({ withOptional: true }),
         options?.defaultValue ?? {},
      );
   }, [JSON.stringify({ schema, dflt: options?.defaultValue })]);

   useEffect(() => {
      const initial =
         searchString.length > 0 ? decodeSearch(searchString) : (options?.defaultValue ?? {});
      const v = parse(schema, Object.assign({}, defaults, initial)) as any;
      setValue(v);
   }, [searchString, JSON.stringify(options?.defaultValue), location]);

   function set<Update extends Partial<s.StaticCoerced<Schema>>>(update: Update): void {
      const search = getWithoutDefaults(Object.assign({}, value, update), defaults);
      const prepared = options?.beforeEncode?.(search) ?? search;
      const encoded = encodeSearch(prepared, { encode: false });
      navigate(location + (encoded.length > 0 ? "?" + encoded : ""));
   }

   return {
      value: value as Required<s.StaticCoerced<Schema>>,
      set,
   };
}

function getWithoutDefaults(value: object, defaultValue: object) {
   return transform(
      value as any,
      (result, value, key) => {
         if (defaultValue && isEqual(value, defaultValue[key])) return;
         result[key] = value;
      },
      {} as object,
   );
}
