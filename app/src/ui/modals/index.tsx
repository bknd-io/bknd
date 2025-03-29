import type { ModalProps } from "@mantine/core";
import { modals as $modals, ModalsProvider, closeModal, openContextModal } from "@mantine/modals";
import type { ComponentProps } from "react";
import { OverlayModal } from "ui/modals/debug/OverlayModal";
import { CreateModal } from "ui/modules/data/components/schema/create-modal/CreateModal";
import { DebugModal } from "./debug/DebugModal";
import { SchemaFormModal } from "./debug/SchemaFormModal";
import { TestModal } from "./debug/TestModal";
import { scaleFadeIn } from "ui/modals/transitions";
import { MediaInfoModal } from "ui/modals/media/MediaInfoModal";

const modals = {
   test: TestModal,
   debug: DebugModal,
   form: SchemaFormModal,
   overlay: OverlayModal,
   dataCreate: CreateModal,
   mediaInfo: MediaInfoModal,
};

declare module "@mantine/modals" {
   export interface MantineModalsOverride {
      modals: typeof modals;
   }
}

export function BkndModalsProvider({ children }) {
   return <ModalsProvider modals={modals}>{children}</ModalsProvider>;
}

function open<Modal extends keyof typeof modals>(
   modal: Modal,
   innerProps: ComponentProps<(typeof modals)[Modal]>["innerProps"],
   { title: _title, ...modalProps }: Partial<ModalProps> = {},
) {
   const title = _title ?? modals[modal].defaultTitle ?? undefined;
   const cmpModalProps = modals[modal].modalProps ?? {};
   const props = {
      title,
      ...modalProps,
      ...cmpModalProps,
      modal,
      innerProps,
   } as any;
   openContextModal({
      transitionProps: {
         transition: scaleFadeIn,
         duration: 300,
      },
      ...props,
   });
   return {
      close: () => close(modal),
      closeAll: $modals.closeAll,
   };
}

function close<Modal extends keyof typeof modals>(modal: Modal) {
   return closeModal(modal);
}

export const bkndModals = {
   ids: Object.fromEntries(Object.keys(modals).map((key) => [key, key])) as {
      [K in keyof typeof modals]: K;
   },
   open,
   close,
   closeAll: $modals.closeAll,
};
