import type { PluginOption } from "vite";

export function injectMain({ mainPath }: { mainPath: string }): PluginOption {
   return {
      name: "inject-main-script",
      transformIndexHtml: {
         order: "pre", // run before other transforms
         handler(html) {
            return {
               html,
               tags: [
                  {
                     tag: "script",
                     attrs: { type: "module", src: mainPath },
                     injectTo: "body",
                  },
               ],
            };
         },
      },
   };
}
