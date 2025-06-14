import type { DB, PrimaryFieldType } from "core";
import { objectTransform } from "core/utils/objects";
import { encodeSearch } from "core/utils/reqres";
import type { EntityData, RepoQueryIn, RepositoryResult } from "data";
import type { Insertable, Selectable, Updateable } from "kysely";
import type { FetchPromise, ModuleApi, ResponseObject } from "modules/ModuleApi";
import useSWR, { type SWRConfiguration, type SWRResponse, mutate } from "swr";
import { type Api, useApi } from "ui/client";

export class UseEntityApiError<Payload = any> extends Error {
   constructor(
      public response: ResponseObject<Payload>,
      fallback?: string,
   ) {
      let message = fallback;
      if ("error" in response) {
         message = response.error as string;
         if (fallback) {
            message = `${fallback}: ${message}`;
         }
      }

      super(message ?? "UseEntityApiError");
   }
}

interface UseEntityReturn<
   Entity extends keyof DB | string,
   Id extends PrimaryFieldType | undefined,
   Data = Entity extends keyof DB ? DB[Entity] : EntityData,
   Response = ResponseObject<RepositoryResult<Selectable<Data>>>,
> {
   create: (input: Insertable<Data>) => Promise<Response>;
   read: (
      query?: RepoQueryIn,
   ) => Promise<
      ResponseObject<RepositoryResult<Id extends undefined ? Selectable<Data>[] : Selectable<Data>>>
   >;
   update: Id extends undefined
      ? (input: Updateable<Data>, id: Id) => Promise<Response>
      : (input: Updateable<Data>) => Promise<Response>;
   _delete: Id extends undefined ? (id: Id) => Promise<Response> : () => Promise<Response>;
}

export const useEntity = <
   Entity extends keyof DB | string,
   Id extends PrimaryFieldType | undefined = undefined,
   Data = Entity extends keyof DB ? DB[Entity] : EntityData,
>(
   entity: Entity,
   id?: Id,
): UseEntityReturn<Entity, Id, Data> => {
   const api = useApi().data;

   return {
      create: async (input: Insertable<Data>) => {
         const res = await api.createOne(entity, input as any);
         if (!res.ok) {
            throw new UseEntityApiError(res, `Failed to create entity "${entity}"`);
         }
         return res as any;
      },
      read: async (query?: RepoQueryIn) => {
         const res = id ? await api.readOne(entity, id!, query) : await api.readMany(entity, query);
         if (!res.ok) {
            throw new UseEntityApiError(res as any, `Failed to read entity "${entity}"`);
         }
         return res as any;
      },
      // @ts-ignore
      update: async (input: Updateable<Data>, _id: PrimaryFieldType | undefined = id) => {
         if (!_id) {
            throw new Error("id is required");
         }
         const res = await api.updateOne(entity, _id, input);
         if (!res.ok) {
            throw new UseEntityApiError(res, `Failed to update entity "${entity}"`);
         }
         return res as any;
      },
      // @ts-ignore
      _delete: async (_id: PrimaryFieldType | undefined = id) => {
         if (!_id) {
            throw new Error("id is required");
         }

         const res = await api.deleteOne(entity, _id);
         if (!res.ok) {
            throw new UseEntityApiError(res, `Failed to delete entity "${entity}"`);
         }
         return res as any;
      },
   };
};

// @todo: try to get from ModuleApi directly
export function makeKey(
   api: ModuleApi,
   entity: string,
   id?: PrimaryFieldType,
   query?: RepoQueryIn,
) {
   return (
      "/" +
      [...(api.options?.basepath?.split("/") ?? []), entity, ...(id ? [id] : [])]
         .filter(Boolean)
         .join("/") +
      (query ? "?" + encodeSearch(query) : "")
   );
}

interface UseEntityQueryReturn<
   Entity extends keyof DB | string,
   Id extends PrimaryFieldType | undefined = undefined,
   Data = Entity extends keyof DB ? Selectable<DB[Entity]> : EntityData,
   Return = Id extends undefined ? ResponseObject<Data[]> : ResponseObject<Data>,
> extends Omit<SWRResponse<Return>, "mutate">,
      Omit<ReturnType<typeof useEntity<Entity, Id>>, "read"> {
   mutate: (id?: PrimaryFieldType) => Promise<any>;
   mutateRaw: SWRResponse<Return>["mutate"];
   api: Api["data"];
   key: string;
}

export const useEntityQuery = <
   Entity extends keyof DB | string,
   Id extends PrimaryFieldType | undefined = undefined,
>(
   entity: Entity,
   id?: Id,
   query?: RepoQueryIn,
   options?: SWRConfiguration & { enabled?: boolean; revalidateOnMutate?: boolean },
): UseEntityQueryReturn<Entity, Id> => {
   const api = useApi().data;
   const key = makeKey(api, entity as string, id, query);
   const { read, ...actions } = useEntity<Entity, Id>(entity, id);
   const fetcher = () => read(query ?? {});

   type T = Awaited<ReturnType<typeof fetcher>>;
   const swr = useSWR<T>(options?.enabled === false ? null : key, fetcher as any, {
      revalidateOnFocus: false,
      keepPreviousData: true,
      ...options,
   });

   const mutateFn = async (id?: PrimaryFieldType) => {
      const entityKey = makeKey(api, entity as string, id);
      return mutate((key) => typeof key === "string" && key.startsWith(entityKey), undefined, {
         revalidate: true,
      });
   };

   const mapped = objectTransform(actions, (action) => {
      return async (...args: any) => {
         // @ts-ignore
         const res = await action(...args);

         // mutate all keys of entity by default
         if (options?.revalidateOnMutate !== false) {
            await mutateFn();
         }
         return res;
      };
   }) as Omit<ReturnType<typeof useEntity<Entity, Id>>, "read">;

   return {
      ...swr,
      ...mapped,
      mutate: mutateFn,
      // @ts-ignore
      mutateRaw: swr.mutate,
      api,
      key,
   };
};

export async function mutateEntityCache<
   Entity extends keyof DB | string,
   Data = Entity extends keyof DB ? DB[Entity] : EntityData,
>(api: Api["data"], entity: Entity, id: PrimaryFieldType, partialData: Partial<Selectable<Data>>) {
   function update(prev: any, partialNext: any) {
      if (
         typeof prev !== "undefined" &&
         typeof partialNext !== "undefined" &&
         "id" in prev &&
         prev.id === id
      ) {
         return { ...prev, ...partialNext };
      }

      return prev;
   }

   const entityKey = makeKey(api, entity as string);

   return mutate(
      (key) => typeof key === "string" && key.startsWith(entityKey),
      async (data) => {
         if (typeof data === "undefined") return;
         if (Array.isArray(data)) {
            return data.map((item) => update(item, partialData));
         }
         return update(data, partialData);
      },
      {
         revalidate: false,
      },
   );
}

interface UseEntityMutateReturn<
   Entity extends keyof DB | string,
   Id extends PrimaryFieldType | undefined = undefined,
   Data = Entity extends keyof DB ? DB[Entity] : EntityData,
> extends Omit<ReturnType<typeof useEntityQuery<Entity, Id>>, "mutate"> {
   mutate: Id extends undefined
      ? (id: PrimaryFieldType, data: Partial<Selectable<Data>>) => Promise<void>
      : (data: Partial<Selectable<Data>>) => Promise<void>;
}

export const useEntityMutate = <
   Entity extends keyof DB | string,
   Id extends PrimaryFieldType | undefined = undefined,
   Data = Entity extends keyof DB ? DB[Entity] : EntityData,
>(
   entity: Entity,
   id?: Id,
   options?: SWRConfiguration,
): UseEntityMutateReturn<Entity, Id, Data> => {
   const { data, ...$q } = useEntityQuery<Entity, Id>(entity, id, undefined, {
      ...options,
      enabled: false,
   });

   const _mutate = id
      ? (data: Partial<Selectable<Data>>) => mutateEntityCache($q.api, entity, id, data)
      : (id: PrimaryFieldType, data: Partial<Selectable<Data>>) =>
           mutateEntityCache($q.api, entity, id, data);

   return {
      ...$q,
      mutate: _mutate,
   } as any;
};
