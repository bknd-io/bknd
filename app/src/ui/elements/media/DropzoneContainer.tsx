import type { Api } from "bknd/client";
import type { RepoQueryIn } from "data";
import type { MediaFieldSchema } from "media/AppMedia";
import type { TAppMediaConfig } from "media/media-schema";
import { type ReactNode, createContext, useContext, useId } from "react";
import { useApi, useApiQuery, useInvalidate } from "ui/client";
import { useEvent } from "ui/hooks/use-event";
import { Dropzone, type DropzoneProps, type DropzoneRenderProps, type FileState } from "./Dropzone";
import { mediaItemsToFileStates } from "./helper";

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
   const defaultQuery = {
      limit: query?.limit ? query?.limit : props.maxItems ? props.maxItems : 50,
      sort: "-id"
   };
   const entity_name = (media?.entity_name ?? "media") as "media";
   //console.log("dropzone:baseUrl", baseUrl);

   const selectApi = (api: Api) =>
      entity
         ? api.data.readManyByReference(entity.name, entity.id, entity.field, {
              ...defaultQuery,
              ...query,
              where: {
                 reference: `${entity.name}.${entity.field}`,
                 entity_id: entity.id,
                 ...query?.where
              }
           })
         : api.data.readMany(entity_name, {
              ...defaultQuery,
              ...query
           });

   const $q = useApiQuery(selectApi, { enabled: initialItems !== false && !initialItems });

   const getUploadInfo = useEvent((file) => {
      const url = entity
         ? api.media.getEntityUploadUrl(entity.name, entity.id, entity.field)
         : api.media.getFileUploadUrl(randomFilename ? undefined : file);

      return {
         url,
         headers: api.media.getUploadHeaders(),
         method: "POST"
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

export function useDropzone() {
   return useContext(DropzoneContainerContext);
}
