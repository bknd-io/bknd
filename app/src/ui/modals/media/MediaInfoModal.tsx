import type { ContextModalProps } from "@mantine/modals";
import type { ReactNode } from "react";
import { useEntityQuery } from "ui/client";
import { type FileState, Media } from "ui/elements";
import { autoFormatString, datetimeStringLocal, formatNumber } from "core/utils";
import { twMerge } from "tailwind-merge";
import { IconButton } from "ui/components/buttons/IconButton";
import { TbCheck, TbCopy } from "react-icons/tb";
import { useClipboard } from "@mantine/hooks";
import { ButtonLink } from "ui/components/buttons/Button";
import { routes } from "ui/lib/routes";
import { useBkndMedia } from "ui/client/schema/media/use-bknd-media";
import { JsonViewer } from "ui";

export type MediaInfoModalProps = {
   file: FileState;
};

export function MediaInfoModal({
   context,
   id,
   innerProps: { file },
}: ContextModalProps<MediaInfoModalProps>) {
   const {
      config: { entity_name, basepath },
   } = useBkndMedia();
   const $q = useEntityQuery(entity_name as "media", undefined, {
      where: {
         path: file.path,
      },
   });
   const close = () => context.closeModal(id);
   const data = $q.data?.[0];
   const origin = window.location.origin;
   const entity = data?.reference ? data?.reference.split(".")[0] : undefined;
   const entityUrl = entity
      ? "/data" + routes.data.entity.edit(entity, data?.entity_id!)
      : undefined;
   const mediaUrl = data?.path
      ? "/data" + routes.data.entity.edit(entity_name, data?.id!)
      : undefined;
   //const assetUrl = data?.path ? origin + basepath + "/file/" + data?.path : undefined;

   return (
      <div className="flex flex-col md:flex-row">
         <div className="flex w-full md:w-[calc(100%-300px)] justify-center items-center bg-lightest min-w-0">
            {/* @ts-ignore */}
            <Media.Preview file={file} className="max-h-[70dvh]" controls muted />
         </div>
         <div className="w-full md:!w-[300px] flex flex-col">
            <Item title="ID" value={data?.id} copyValue={origin + mediaUrl} first>
               {mediaUrl && (
                  <ButtonLink
                     href={mediaUrl!}
                     size="small"
                     className="py-1.5 px-2 !leading-none font-mono"
                     onClick={close}
                  >
                     #{String(data?.id)}
                  </ButtonLink>
               )}
            </Item>
            <Item title="Path" value={data?.path} />
            <Item title="Mime Type" value={data?.mime_type} />
            <Item
               title="Size"
               value={data?.size && formatNumber.fileSize(data.size, 1)}
               copyValue={data?.size}
            />
            <Item title="Etag" value={data?.etag} />
            <Item title="Entity" copyValue={origin + entityUrl}>
               {entityUrl && (
                  <ButtonLink
                     href={entityUrl!}
                     size="small"
                     className="py-1.5 px-2 !leading-none font-mono"
                     onClick={close}
                  >
                     {data?.reference} #{data?.entity_id}
                  </ButtonLink>
               )}
            </Item>
            <Item
               title="Modified At"
               value={data?.modified_at && datetimeStringLocal(data?.modified_at)}
               copyValue={data?.modified_at}
            />
            <Item title="Metadata" value={data?.metadata} copyable={false}>
               {data?.metadata && (
                  <JsonViewer
                     json={data?.metadata}
                     expand={2}
                     showCopy
                     className="w-full text-sm bg-primary/2 pt-2.5 rounded-lg"
                     copyIconProps={{
                        className: "size-6 opacity-20 group-hover:opacity-100 transition-all",
                     }}
                  />
               )}
            </Item>
         </div>
      </div>
   );
}

const Item = ({
   title,
   children,
   value,
   first,
   copyable = true,
   copyValue,
}: {
   title: string;
   children?: ReactNode;
   value?: any;
   first?: boolean;
   copyable?: boolean;
   copyValue?: any;
}) => {
   const cb = useClipboard();

   const is_null = !children && (value === null || typeof value === "undefined");
   const can_copy = copyable && !is_null && cb.copy !== undefined;
   const _value = value
      ? typeof value === "object" && !is_null
         ? JSON.stringify(value)
         : String(value)
      : undefined;

   return (
      <div
         className={twMerge(
            "flex flex-col gap-1 py-3 pl-5 pr-3 group",
            !first && "border-t border-muted",
         )}
      >
         <div className="text-sm font-bold opacity-50">{autoFormatString(title)}</div>
         <div className="flex flex-row gap-1 justify-between items-center">
            {children ?? (
               <div className={twMerge("font-mono truncate", is_null && "opacity-30")}>
                  {is_null ? "null" : _value}
               </div>
            )}
            {can_copy && (
               <IconButton
                  Icon={cb.copied ? TbCheck : TbCopy}
                  className={twMerge(
                     "size-6 opacity-20 group-hover:opacity-100 transition-all",
                     cb.copied && "text-success-foreground opacity-100",
                  )}
                  onClick={() => cb.copy(copyValue ? copyValue : value)}
               />
            )}
         </div>
      </div>
   );
};

MediaInfoModal.defaultTitle = undefined;
MediaInfoModal.modalProps = {
   withCloseButton: false,
   size: "auto",
   //size: "90%",
   centered: true,
   styles: {
      content: {
         overflowY: "initial !important",
      },
   },
   classNames: {
      root: "bknd-admin w-full max-w-xl",
      content: "overflow-hidden",
      title: "font-bold !text-md",
      body: "max-h-inherit !p-0",
   },
};
