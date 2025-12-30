import { type NotificationData, notifications } from "@mantine/notifications";
import type { Api } from "Api";
import { ucFirst } from "bknd/utils";
import type { ModuleConfigs } from "modules";
import type { ResponseObject } from "modules/ModuleApi";
import type { ConfigUpdateResponse } from "modules/server/SystemController";

export type SchemaActionsProps = {
   api: Api;
   setSchema: React.Dispatch<React.SetStateAction<any>>;
   reloadSchema: () => Promise<void>;
};

export type TSchemaActions = ReturnType<typeof getSchemaActions>;

export function getSchemaActions({ api, setSchema, reloadSchema }: SchemaActionsProps) {
   async function handleConfigUpdate<Module extends keyof ModuleConfigs>(
      action: string,
      module: Module,
      res: ResponseObject<ConfigUpdateResponse<Module>>,
      path?: string,
   ): Promise<boolean> {
      const base: Partial<NotificationData> = {
         id: "schema-" + [action, module, path].join("-"),
         position: "top-right",
         autoClose: 3000,
      };

      if (res.success) {
         console.log("update config", action, module, path, res.body);
         if (res.body.success) {
            setSchema((prev) => {
               if (!prev) return prev;
               return {
                  ...prev,
                  config: {
                     ...prev.config,
                     [module]: res.config,
                  },
               };
            });
         }

         notifications.show({
            ...base,
            title: `Config updated: ${ucFirst(module)}`,
            color: "blue",
            message: `Operation ${action.toUpperCase()} at ${module}${path ? "." + path : ""}`,
         });
      } else {
         notifications.show({
            ...base,
            title: `Config Update failed: ${ucFirst(module)}${path ? "." + path : ""}`,
            color: "red",
            withCloseButton: true,
            autoClose: false,
            message: res.error ?? "Failed to complete config update",
         });
      }

      return res.success;
   }

   return {
      reload: reloadSchema,
      set: async <Module extends keyof ModuleConfigs>(
         module: keyof ModuleConfigs,
         value: ModuleConfigs[Module],
         force?: boolean,
      ) => {
         const res = await api.system.setConfig(module, value, force);
         return await handleConfigUpdate("set", module, res);
      },
      patch: async <Module extends keyof ModuleConfigs>(
         module: Module,
         path: string,
         value: any,
      ): Promise<boolean> => {
         const res = await api.system.patchConfig(module, path, value);
         return await handleConfigUpdate("patch", module, res, path);
      },
      overwrite: async <Module extends keyof ModuleConfigs>(
         module: Module,
         path: string,
         value: any,
      ) => {
         const res = await api.system.overwriteConfig(module, path, value);
         return await handleConfigUpdate("overwrite", module, res, path);
      },
      add: async <Module extends keyof ModuleConfigs>(module: Module, path: string, value: any) => {
         const res = await api.system.addConfig(module, path, value);
         return await handleConfigUpdate("add", module, res, path);
      },
      remove: async <Module extends keyof ModuleConfigs>(module: Module, path: string) => {
         const res = await api.system.removeConfig(module, path);
         return await handleConfigUpdate("remove", module, res, path);
      },
   };
}
