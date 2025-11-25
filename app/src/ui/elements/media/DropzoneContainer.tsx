import type { PrimaryFieldType, RepoQueryIn } from "bknd";
import type { MediaFieldSchema } from "media/AppMedia";
import type { TAppMediaConfig } from "media/media-schema";
import { useId, useEffect, useRef, useState } from "react";
import { type Api, useApi, useApiInfiniteQuery, useApiQuery, useInvalidate } from "bknd/client";
import { useEvent } from "ui/hooks/use-event";
import { Dropzone, type DropzoneProps } from "./Dropzone";
import { mediaItemsToFileStates } from "./helper";
import { useInViewport } from "@mantine/hooks";

export type DropzoneContainerProps = {
   /**
    * The initial items to display
    * @default []
    */
   initialItems?: MediaFieldSchema[] | false;
   /**
    * Whether to use infinite scrolling
    * @default false
    */
   infinite?: boolean;
   /**
    * If given, the initial media items fetched will be from this entity
    * @default undefined
    */
   entity?: {
      name: string;
      id: PrimaryFieldType;
      field: string;
   };
   /**
    * The media config
    * @default undefined
    */
   media?: Pick<TAppMediaConfig, "entity_name" | "storage">;
   /**
    * Query to filter the media items
    */
   query?: RepoQueryIn;
   /**
    * Whether to use a random filename
    * @default false
    */
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
      ? useApiInfiniteQuery(selectApi, {
           pageSize,
        })
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

   const key = id + JSON.stringify(initialItems);

   // check if endpoint reeturns a total, then reaching end is easy
   const total = "_data" in $q ? $q._data?.[0]?.body.meta.count : undefined;
   let placeholderLength = 0;
   if (infinite && "setSize" in $q) {
      placeholderLength =
         typeof total === "number"
            ? total
            : $q.endReached
              ? _initialItems.length
              : _initialItems.length + pageSize;

      // in case there is no total, we overfetch but SWR don't reflect an empty result
      // therefore we check if it stopped loading, but has a bigger page size than the total.
      // if that's the case, we assume we reached the end.
      if (!total && !$q.isValidating && pageSize * $q.size >= placeholderLength) {
         placeholderLength = _initialItems.length;
      }
   }

   return (
      <Dropzone
         key={key}
         getUploadInfo={getUploadInfo}
         handleDelete={handleDelete}
         autoUpload
         initialItems={_initialItems}
         footer={
            infinite &&
            "setSize" in $q && (
               <Footer
                  items={_initialItems.length}
                  length={placeholderLength}
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
