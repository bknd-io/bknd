/**
 * See https://github.com/wakujs/waku/issues/1499
 */

import { Suspense, lazy } from "react";
import { getUserApi } from "../../lib/waku/server";

const AdminComponent = lazy(() => import("./_components/AdminLoader"));

export default async function HomePage() {
   const api = await getUserApi({ verify: true });

   // @ts-ignore
   const styles = await import("bknd/dist/styles.css?inline").then((m) => m.default);
   return (
      <>
         <style>{styles}</style>
         <Suspense fallback={null}>
            <AdminComponent withProvider={{ user: api.getUser()! }} />
         </Suspense>
      </>
   );
}

// Enable dynamic server rendering.
// Static rendering is possible if you want to render at build time.
// The Hono context will not be available.
export const getConfig = async () => {
   return {
      render: "dynamic",
   } as const;
};
