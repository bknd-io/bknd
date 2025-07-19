import "../styles.css";

import type { ReactNode } from "react";

import { ClientProvider } from "bknd/client";

type RootLayoutProps = { children: ReactNode };

export default async function RootLayout({ children }: RootLayoutProps) {
   const data = await getData();

   return children;
}

const getData = async () => {
   const data = {
      description: "An internet website!",
      icon: "/images/favicon.png",
   };

   return data;
};

export const getConfig = async () => {
   return {
      render: "static",
   } as const;
};
