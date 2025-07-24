"use client";
import { RootProvider } from "fumadocs-ui/provider";
import Search from "./_components/Search";
import type { ReactNode } from "react";

export function Provider({ children }: { children: ReactNode }) {
  return (
    <RootProvider search={{ SearchDialog: Search }}>{children}</RootProvider>
  );
}
