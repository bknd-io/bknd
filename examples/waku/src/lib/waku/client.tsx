"use client";

import * as React from "react";

export function BrowserOnly(props: React.SuspenseProps) {
   const hydrated = useHydrated();
   if (!hydrated) {
      return props.fallback;
   }
   return <React.Suspense {...props} />;
}

const noopStore = () => () => {};

const useHydrated = () =>
   React.useSyncExternalStore(
      noopStore,
      () => true,
      () => false
   );
