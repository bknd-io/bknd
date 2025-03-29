import type { Api } from "Api";
import { FetchPromise, type ModuleApi, type ResponseObject } from "modules/ModuleApi";
import useSWR, { type SWRConfiguration, useSWRConfig } from "swr";
import useSWRInfinite from "swr/infinite";
import { useApi } from "ui/client";
import { useState } from "react";

export const useApiQuery = <
   Data,
   RefineFn extends (data: ResponseObject<Data>) => unknown = (data: ResponseObject<Data>) => Data,
>(
   fn: (api: Api) => FetchPromise<Data>,
   options?: SWRConfiguration & { enabled?: boolean; refine?: RefineFn },
) => {
   const api = useApi();
   const promise = fn(api);
   const refine = options?.refine ?? ((data: any) => data);
   const fetcher = () => promise.execute().then(refine);
   const key = promise.key();

   type RefinedData = RefineFn extends (data: ResponseObject<Data>) => infer R ? R : Data;

   const swr = useSWR<RefinedData>(options?.enabled === false ? null : key, fetcher, options);
   return {
      ...swr,
      promise,
      key,
      api,
   };
};

/** @attention: highly experimental, use with caution! */
export const useApiInfiniteQuery = <
   Data,
   RefineFn extends (data: ResponseObject<Data>) => unknown = (data: ResponseObject<Data>) => Data,
>(
   fn: (api: Api, page: number) => FetchPromise<Data>,
   options?: SWRConfiguration & { refine?: RefineFn },
) => {
   const [endReached, setEndReached] = useState(false);
   const api = useApi();
   const promise = (page: number) => fn(api, page);
   const refine = options?.refine ?? ((data: any) => data);

   type RefinedData = RefineFn extends (data: ResponseObject<Data>) => infer R ? R : Data;

   // @ts-ignore
   const swr = useSWRInfinite<RefinedData>(
      (index, previousPageData: any) => {
         if (previousPageData && !previousPageData.length) {
            setEndReached(true);
            return null; // reached the end
         }
         return promise(index).request.url;
      },
      (url: string) => {
         return new FetchPromise(new Request(url), { fetcher: api.fetcher }, refine).execute();
      },
      {
         revalidateFirstPage: false,
      },
   );
   // @ts-ignore
   const data = swr.data ? [].concat(...swr.data) : [];
   return {
      ...swr,
      _data: swr.data,
      data,
      endReached,
      promise: promise(swr.size),
      key: promise(swr.size).key(),
      api,
   };
};

export const useInvalidate = (options?: { exact?: boolean }) => {
   const mutate = useSWRConfig().mutate;
   const api = useApi();

   return async (arg?: string | ((api: Api) => FetchPromise<any> | ModuleApi<any>)) => {
      let key = "";
      if (typeof arg === "string") {
         key = arg;
      } else if (typeof arg === "function") {
         key = arg(api).key();
      }

      if (options?.exact) return mutate(key);
      return mutate((k) => typeof k === "string" && k.startsWith(key));
   };
};
