import { useBknd } from "ui/client/BkndProvider";
import type { DropdownProps } from "ui/components/overlay/Dropdown";

export type BkndAdminAppShellOptions = {
   userMenu?: DropdownProps["items"];
};

export function useAppShellAdminOptions() {
   const { options } = useBknd();
   const userMenu = options?.appShell?.userMenu ?? [];
   return { userMenu };
}
