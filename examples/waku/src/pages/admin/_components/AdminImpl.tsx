"use client";

import { Admin, type BkndAdminProps } from "bknd/ui";

export const AdminImpl = (props: BkndAdminProps) => {
   if (typeof window === "undefined") {
      return null;
   }

   return (
      <Admin
         withProvider
         config={{
            basepath: "/admin",
            logo_return_path: "/../",
            ...props.config,
         }}
         {...props}
      />
   );
};

export default AdminImpl;
