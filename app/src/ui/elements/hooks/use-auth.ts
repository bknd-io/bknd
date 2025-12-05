import type { AppAuthSchema } from "auth/auth-schema";
import { useEffect, useState } from "react";
import { useApi } from "bknd/client";

type AuthStrategyData = Pick<AppAuthSchema, "strategies" | "basepath">;
export const useAuthStrategies = (options?: {
   baseUrl?: string;
}): Partial<AuthStrategyData> & {
   loading: boolean;
} => {
   const [data, setData] = useState<AuthStrategyData>();
   const api = useApi(options?.baseUrl);

   useEffect(() => {
      (async () => {
         const res = await api.auth.strategies();
         //console.log("res", res);
         if (res.res.ok) {
            setData(res.body);
         }
      })();
   }, [options?.baseUrl]);

   return { strategies: data?.strategies, basepath: data?.basepath, loading: !data };
};
