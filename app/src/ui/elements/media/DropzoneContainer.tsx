import type { Api } from "bknd/client";
import type { RepoQueryIn } from "data";
import type { MediaFieldSchema } from "media/AppMedia";
import type { TAppMediaConfig } from "media/media-schema";
import { useId, useEffect, useRef, useState } from "react";
import { useApi, useApiInfiniteQuery, useApiQuery, useInvalidate } from "ui/client";
import { useEvent } from "ui/hooks/use-event";
import { Dropzone, type DropzoneProps } from "./Dropzone";
import { mediaItemsToFileStates } from "./helper";
import { useInViewport } from "@mantine/hooks";

export type DropzoneContainerProps = {
   initialItems?: MediaFieldSchema[] | false;
   infinite?: boolean;
   entity?: {
      name: string;
      id: number;
      field: string;
   };
   media?: Pick<TAppMediaConfig, "entity_name" | "storage">;
   query?: RepoQueryIn;
   randomFilename?: boolean;
} & Omit<Partial<DropzoneProps>, "initialItems">;

export function DropzoneContainer({
   initialItems,
   media,
   entity,
   query,
   randomFilename,
   infinite = false,
   ...props
}: DropzoneContainerProps) {
   const id = useId();
   const api = useApi();
   const invalidate = useInvalidate();
   const baseUrl = api.baseUrl;
   const pageSize = query?.limit ?? props.maxItems ?? 50;
   const defaultQuery = (page: number) => ({
      limit: pageSize,
      offset: page * pageSize,
   });
   const entity_name = (media?.entity_name ?? "media") as "media";

   const selectApi = (api: Api, page: number = 0) =>
      entity
         ? api.data.readManyByReference(entity.name, entity.id, entity.field, {
              ...defaultQuery(page),
              ...query,
           })
         : api.data.readMany(entity_name, {
              ...defaultQuery(page),
              ...query,
           });

   const $q = infinite
      ? useApiInfiniteQuery(selectApi, {})
      : useApiQuery(selectApi, {
           enabled: initialItems !== false && !initialItems,
           revalidateOnFocus: false,
        });

   const getUploadInfo = useEvent((file: { path: string }) => {
      const url = entity
         ? api.media.getEntityUploadUrl(entity.name, entity.id, entity.field)
         : api.media.getFileUploadUrl(randomFilename ? undefined : file);

      return {
         url,
         headers: api.media.getUploadHeaders(),
         method: "POST",
      };
   });

   const refresh = useEvent(async () => {
      await invalidate($q.promise.key({ search: false }));
   });

   const handleDelete = useEvent(async (file: { path: string }) => {
      return api.media.deleteFile(file.path);
   });

   const actualItems = (initialItems ??
      (Array.isArray($q.data) ? $q.data : []) ??
      []) as MediaFieldSchema[];
   const _initialItems = mediaItemsToFileStates(actualItems, { baseUrl });

   const key = id + JSON.stringify(_initialItems);
   return (
      <Dropzone
         key={id + key}
         getUploadInfo={getUploadInfo}
         handleDelete={handleDelete}
         /* onUploaded={refresh}
         onDeleted={refresh} */
         autoUpload
         initialItems={_initialItems}
         footer={
            infinite &&
            "setSize" in $q && (
               <Footer
                  items={_initialItems.length}
                  length={Math.min(
                     $q._data?.[0]?.body.meta.count ?? 0,
                     _initialItems.length + pageSize,
                  )}
                  onFirstVisible={() => $q.setSize($q.size + 1)}
               />
            )
         }
         {...props}
      />
   );
}

const Footer = ({ items = 0, length = 0, onFirstVisible }) => {
   const { ref, inViewport } = useInViewport();
   const [visible, setVisible] = useState(0);
   const lastItemsCount = useRef(-1);

   useEffect(() => {
      if (inViewport && items > lastItemsCount.current) {
         lastItemsCount.current = items;
         setVisible((v) => v + 1);
         onFirstVisible();
      }
   }, [inViewport]);
   const _len = length - items;
   if (_len <= 0) return null;

   return new Array(Math.max(length - items, 0))
      .fill(0)
      .map((_, i) => (
         <div
            key={i}
            ref={i === 0 ? ref : undefined}
            className="w-[49%] md:w-60 bg-muted aspect-square"
         />
      ));
};
