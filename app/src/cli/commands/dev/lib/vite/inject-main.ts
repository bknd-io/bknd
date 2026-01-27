import type { PluginOption } from "vite";

export function injectMain(options?: { appPath?: string; rootId?: string }): PluginOption {
   const appPath = options?.appPath ?? "/App.tsx";
   const rootId = options?.rootId ?? "root";
   const publicId = "/@virtual/react-main.js";
   const internalId = "\0virtual-react-main.js";

   return [
      {
         name: "bknd-virtual-react-entry",
         transformIndexHtml(html) {
            return {
               html,
               tags: [
                  {
                     tag: "script",
                     injectTo: "body",
                     attrs: {
                        type: "module",
                        src: publicId,
                     },
                  },
               ],
            };
         },
         resolveId(id) {
            if (id === publicId) {
               return internalId;
            }
            return null;
         },
         load(id) {
            if (id === internalId) {
               return `
import React from "react";
import ReactDOM from "react-dom/client";
import App from "${appPath}";
import { ClientProvider } from "bknd/client";

const container = document.getElementById("${rootId}");
if (!container) {
  throw new Error("Cannot find #${rootId} element");
}

const root = ReactDOM.createRoot(container);
root.render(
  React.createElement(
    React.StrictMode,
    null,
    React.createElement(ClientProvider, null, React.createElement(App, null))
  )
);
`;
            }
            return null;
         },
      },
   ];
}
