"use client";

import type { BkndAdminProps } from "bknd/ui";
import { lazy } from "react";
import { BrowserOnly } from "../../../lib/waku/client";

const AdminImpl = import.meta.env.SSR ? undefined : lazy(() => import("./AdminImpl"));

export const AdminLoader = (props: BkndAdminProps) => {
   return (
      <BrowserOnly fallback={null}>
         {/* @ts-expect-error */}
         <AdminImpl {...props} />
      </BrowserOnly>
   );
};

export default AdminLoader;
