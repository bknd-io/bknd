import type { Api } from "bknd/client";
import type { RepoQueryIn } from "data";
import type { MediaFieldSchema } from "media/AppMedia";
import type { TAppMediaConfig } from "media/media-schema";
import {
   type ReactNode,
   createContext,
   useContext,
   useId,
   useEffect,
   useRef,
   useState,
} from "react";
import { useApi, useApiInfiniteQuery, useInvalidate } from "ui/client";
import { useEvent } from "ui/hooks/use-event";
import { Dropzone, type DropzoneProps, type DropzoneRenderProps, type FileState } from "./Dropzone";
import { mediaItemsToFileStates } from "./helper";
import { useInViewport } from "@mantine/hooks";

export type DropzoneContainerProps = {
   children?: ReactNode;
   initialItems?: MediaFieldSchema[] | false;
   entity?: {
      name: string;
      id: number;
      field: string;
   };
   media?: Pick<TAppMediaConfig, "entity_name" | "storage">;
   query?: RepoQueryIn;
   randomFilename?: boolean;
} & Omit<Partial<DropzoneProps>, "children" | "initialItems">;

const DropzoneContainerContext = createContext<DropzoneRenderProps>(undefined!);

export function DropzoneContainer({
   initialItems,
   media,
   entity,
   query,
   children,
   randomFilename,
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
      sort: "-id",
   });
   const entity_name = (media?.entity_name ?? "media") as "media";
   //console.log("dropzone:baseUrl", baseUrl);

   const selectApi = (api: Api, page: number) =>
      entity
         ? api.data.readManyByReference(entity.name, entity.id, entity.field, {
              ...query,
              where: {
                 reference: `${entity.name}.${entity.field}`,
                 entity_id: entity.id,
                 ...query?.where,
              },
              ...defaultQuery(page),
           })
         : api.data.readMany(entity_name, {
              ...query,
              ...defaultQuery(page),
           });

   const $q = useApiInfiniteQuery(selectApi, {});

   const getUploadInfo = useEvent((file) => {
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

   const handleDelete = useEvent(async (file: FileState) => {
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
         onUploaded={refresh}
         onDeleted={refresh}
         autoUpload
         initialItems={_initialItems}
         footer={
            <Footer
               items={_initialItems.length}
               length={$q._data?.[0]?.body.meta.count ?? 0}
               onFirstVisible={() => $q.setSize($q.size + 1)}
            />
         }
         {...props}
      >
         {children
            ? (props) => (
                 <DropzoneContainerContext.Provider value={props}>
                    {children}
                 </DropzoneContainerContext.Provider>
              )
            : undefined}
      </Dropzone>
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

   return new Array(Math.max(length - items, 0)).fill(0).map((_, i) => (
      <div
         key={i}
         ref={i === 0 ? ref : undefined}
         className="w-[49%] md:w-60 bg-muted aspect-square"
      >
         {i === 0 ? (inViewport ? `load ${visible}` : "first") : "other"}
      </div>
   ));
};

export function useDropzone() {
   return useContext(DropzoneContainerContext);
}
