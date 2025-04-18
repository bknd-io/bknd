import type { ModuleConfigs, ModuleSchemas } from "modules";
import { getDefaultConfig, getDefaultSchema } from "modules/ModuleManager";
import { createContext, startTransition, useContext, useEffect, useRef, useState } from "react";
import { useApi } from "ui/client";
import { type TSchemaActions, getSchemaActions } from "./schema/actions";
import { AppReduced } from "./utils/AppReduced";
import type { AppTheme } from "ui/client/use-theme";
import { Message } from "ui/components/display/Message";
import { useNavigate } from "ui/lib/routes";

export type BkndAdminOptions = {
   logo_return_path?: string;
   basepath?: string;
   theme?: AppTheme;
};
type BkndContext = {
   version: number;
   schema: ModuleSchemas;
   config: ModuleConfigs;
   permissions: string[];
   hasSecrets: boolean;
   requireSecrets: () => Promise<void>;
   actions: ReturnType<typeof getSchemaActions>;
   app: AppReduced;
   options: BkndAdminOptions;
   fallback: boolean;
};

const BkndContext = createContext<BkndContext>(undefined!);
export type { TSchemaActions };

enum Fetching {
   None = 0,
   Schema = 1,
   Secrets = 2,
}

export function BkndProvider({
   includeSecrets = false,
   options,
   children,
   fallback = null,
}: {
   includeSecrets?: boolean;
   children: any;
   fallback?: React.ReactNode;
   options?: BkndAdminOptions;
}) {
   const [withSecrets, setWithSecrets] = useState<boolean>(includeSecrets);
   const [schema, setSchema] =
      useState<Pick<BkndContext, "version" | "schema" | "config" | "permissions" | "fallback">>();
   const [fetched, setFetched] = useState(false);
   const [error, setError] = useState<boolean>();
   const errorShown = useRef<boolean>(false);
   const fetching = useRef<Fetching>(Fetching.None);
   const [local_version, set_local_version] = useState(0);
   const api = useApi();

   async function reloadSchema() {
      await fetchSchema(includeSecrets, {
         force: true,
         fresh: true,
      });
   }

   async function fetchSchema(
      _includeSecrets: boolean = false,
      opts?: {
         force?: boolean;
         fresh?: boolean;
      },
   ) {
      const requesting = withSecrets ? Fetching.Secrets : Fetching.Schema;
      if (fetching.current === requesting) return;

      if (withSecrets && opts?.force !== true) return;
      fetching.current = requesting;

      const res = await api.system.readSchema({
         config: true,
         secrets: _includeSecrets,
         fresh: opts?.fresh,
      });

      if (!res.ok) {
         if (errorShown.current) return;
         errorShown.current = true;

         setError(true);
         // if already has schema, don't overwrite
         if (fetched && schema?.schema) return;
      } else if (error) {
         setError(false);
      }

      const newSchema = res.ok
         ? res.body
         : ({
              version: 0,
              schema: getDefaultSchema(),
              config: getDefaultConfig(),
              permissions: [],
              fallback: true,
           } as any);

      startTransition(() => {
         const commit = () => {
            setSchema(newSchema);
            setWithSecrets(_includeSecrets);
            setFetched(true);
            set_local_version((v) => v + 1);
            fetching.current = Fetching.None;
         };

         if ("startViewTransition" in document) {
            document.startViewTransition(commit);
         } else {
            commit();
         }
      });
   }

   async function requireSecrets() {
      if (withSecrets) return;
      await fetchSchema(true);
   }

   useEffect(() => {
      if (schema?.schema) return;
      fetchSchema(includeSecrets);
   }, []);

   if (!fetched || !schema) return fallback;
   const app = new AppReduced(schema?.config as any, options);
   const actions = getSchemaActions({ api, setSchema, reloadSchema });
   const hasSecrets = withSecrets && !error;

   return (
      <BkndContext.Provider
         value={{ ...schema, actions, requireSecrets, app, options: app.options, hasSecrets }}
         key={local_version}
      >
         {error ? <AccessDenied /> : children}
      </BkndContext.Provider>
   );
}

function AccessDenied() {
   const [navigate] = useNavigate();
   return (
      <Message.MissingPermission
         what="the Admin UI"
         primary={{
            children: "Login",
            onClick: () => navigate("/auth/login"),
         }}
      />
   );
}

export function useBknd({ withSecrets }: { withSecrets?: boolean } = {}): BkndContext {
   const ctx = useContext(BkndContext);
   if (withSecrets) ctx.requireSecrets();

   return ctx;
}

export function useBkndOptions(): BkndAdminOptions {
   const ctx = useContext(BkndContext);
   return (
      ctx.options ?? {
         basepath: "/",
      }
   );
}
