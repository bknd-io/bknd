"use client";

import { type BkndAdminProps, Admin } from "bknd/ui";
import { useEffect, useState } from "react";

export function AdminComponent(props: BkndAdminProps) {
   const [ready, setReady] = useState(false);

   useEffect(() => {
      if (typeof window !== "undefined") setReady(true);
   }, []);
   if (!ready) return null;

   return <Admin {...props} />;
}
