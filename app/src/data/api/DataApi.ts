import type { DB } from "core";
import type { EntityData, RepoQueryIn, RepositoryResultJSON } from "data";
import type { Insertable, Selectable, Updateable } from "kysely";
import { type BaseModuleApiOptions, ModuleApi, type PrimaryFieldType } from "modules";
import type { FetchPromise, ResponseObject } from "modules/ModuleApi";

export type DataApiOptions = BaseModuleApiOptions & {
   queryLengthLimit: number;
   defaultQuery: Partial<RepoQueryIn>;
};

export class DataApi extends ModuleApi<DataApiOptions> {
   protected override getDefaultOptions(): Partial<DataApiOptions> {
      return {
         basepath: "/api/data",
         queryLengthLimit: 1000,
         defaultQuery: {
            limit: 10,
         },
      };
   }

   private requireObjectSet(obj: any, message?: string) {
      if (!obj || typeof obj !== "object" || Object.keys(obj).length === 0) {
         throw new Error(message ?? "object is required");
      }
   }

   readOne<E extends keyof DB | string>(
      entity: E,
      id: PrimaryFieldType,
      query: Omit<RepoQueryIn, "where" | "limit" | "offset"> = {},
   ) {
      type Data = E extends keyof DB ? Selectable<DB[E]> : EntityData;
      return this.get<RepositoryResultJSON<Data>>(["entity", entity as any, id], query);
   }

   readOneBy<E extends keyof DB | string>(
      entity: E,
      query: Omit<RepoQueryIn, "limit" | "offset" | "sort"> = {},
   ) {
      type Data = E extends keyof DB ? Selectable<DB[E]> : EntityData;
      type T = RepositoryResultJSON<Data>;
      return this.readMany(entity, {
         ...query,
         limit: 1,
         offset: 0,
      }).refine((data) => data[0]) as unknown as FetchPromise<ResponseObject<T>>;
   }

   readMany<E extends keyof DB | string>(entity: E, query: RepoQueryIn = {}) {
      type Data = E extends keyof DB ? Selectable<DB[E]> : EntityData;
      type T = RepositoryResultJSON<Data[]>;

      const input = query ?? this.options.defaultQuery;
      const req = this.get<T>(["entity", entity as any], input);

      if (req.request.url.length <= this.options.queryLengthLimit) {
         return req;
      }

      return this.post<T>(["entity", entity as any, "query"], input);
   }

   readManyByReference<E extends keyof DB | string, R extends keyof DB | string>(
      entity: E,
      id: PrimaryFieldType,
      reference: R,
      query: RepoQueryIn = {},
   ) {
      type Data = R extends keyof DB ? Selectable<DB[R]> : EntityData;
      return this.get<RepositoryResultJSON<Data[]>>(
         ["entity", entity as any, id, reference],
         query ?? this.options.defaultQuery,
      );
   }

   createOne<E extends keyof DB | string, Input = E extends keyof DB ? DB[E] : EntityData>(
      entity: E,
      input: Insertable<Input>,
   ) {
      type Data = E extends keyof DB ? Selectable<DB[E]> : EntityData;
      return this.post<RepositoryResultJSON<Data>>(["entity", entity as any], input);
   }

   createMany<E extends keyof DB | string, Input = E extends keyof DB ? DB[E] : EntityData>(
      entity: E,
      input: Insertable<Input>[],
   ) {
      if (!input || !Array.isArray(input) || input.length === 0) {
         throw new Error("input is required");
      }
      type Data = E extends keyof DB ? Selectable<DB[E]> : EntityData;
      return this.post<RepositoryResultJSON<Data[]>>(["entity", entity as any], input);
   }

   updateOne<E extends keyof DB | string, Input = E extends keyof DB ? DB[E] : EntityData>(
      entity: E,
      id: PrimaryFieldType,
      input: Updateable<Input>,
   ) {
      if (!id) throw new Error("ID is required");
      type Data = E extends keyof DB ? Selectable<DB[E]> : EntityData;
      return this.patch<RepositoryResultJSON<Data>>(["entity", entity as any, id], input);
   }

   updateMany<E extends keyof DB | string, Input = E extends keyof DB ? DB[E] : EntityData>(
      entity: E,
      where: RepoQueryIn["where"],
      update: Updateable<Input>,
   ) {
      this.requireObjectSet(where);
      type Data = E extends keyof DB ? Selectable<DB[E]> : EntityData;
      return this.patch<RepositoryResultJSON<Data[]>>(["entity", entity as any], {
         update,
         where,
      });
   }

   deleteOne<E extends keyof DB | string>(entity: E, id: PrimaryFieldType) {
      if (!id) throw new Error("ID is required");
      type Data = E extends keyof DB ? Selectable<DB[E]> : EntityData;
      return this.delete<RepositoryResultJSON<Data>>(["entity", entity as any, id]);
   }

   deleteMany<E extends keyof DB | string>(entity: E, where: RepoQueryIn["where"]) {
      this.requireObjectSet(where);
      type Data = E extends keyof DB ? Selectable<DB[E]> : EntityData;
      return this.delete<RepositoryResultJSON<Data>>(["entity", entity as any], where);
   }

   count<E extends keyof DB | string>(entity: E, where: RepoQueryIn["where"] = {}) {
      return this.post<RepositoryResultJSON<{ entity: E; count: number }>>(
         ["entity", entity as any, "fn", "count"],
         where,
      );
   }

   exists<E extends keyof DB | string>(entity: E, where: RepoQueryIn["where"] = {}) {
      return this.post<RepositoryResultJSON<{ entity: E; exists: boolean }>>(
         ["entity", entity as any, "fn", "exists"],
         where,
      );
   }
}
