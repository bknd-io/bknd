import { RelativeFS } from "./RelativeFS";
//import { $console } from "bknd/utils";
import { type ViteDevServer, createServer, type UserConfig, createBuilder } from "vite";
import { readdir, copyFile, stat } from "node:fs/promises";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { getRelativeDistPath } from "cli/utils/sys";
import { injectMain } from "./vite/inject-main";
import { devFsVitePlugin } from "adapter/cloudflare";

export type ProjectOptions = {
   userPath?: string;
   templatePath?: string;
};

// @todo: add multiple public dirs
// @todo: add npm install (first time)
// @todo: add package.json
export class Project {
   public userFs: RelativeFS;
   public templateFs: RelativeFS;
   private _server?: ViteDevServer;

   constructor(public options: ProjectOptions) {
      this.userFs = new RelativeFS(options.userPath ?? process.cwd());
      this.templateFs = new RelativeFS(options.templatePath ?? "src/cli/commands/dev/template");
   }

   get server() {
      if (!this._server) {
         throw new Error("Server not initialized");
      }
      return this._server!;
   }

   async init() {
      const source = this.templateFs.root;
      const destination = this.userFs.root;

      // recursively copy all files and directories from source to dest
      const copyRecursive = async (src: string, dst: string) => {
         const entries = await readdir(src, { withFileTypes: true });

         for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const dstPath = path.join(dst, entry.name);

            if (entry.isDirectory()) {
               await this.userFs.makeDir(path.relative(destination, dstPath));
               await copyRecursive(srcPath, dstPath);
            } else if (entry.isFile()) {
               const exists = await stat(dstPath)
                  .then((s) => s.isFile())
                  .catch(() => null);

               // only copy everything from ".bknd" with override
               if (!exists || (dstPath.includes(".bknd") && !dstPath.includes("bknd-types.d.ts"))) {
                  await copyFile(srcPath, dstPath);
               }
            }
         }
      };

      await copyRecursive(source, destination);
      this._server = await createServer(this.getViteConfig());
   }

   private getViteConfig(): UserConfig {
      return {
         clearScreen: false,
         publicDir: getRelativeDistPath() + "/static",
         plugins: [
            react(),
            tailwindcss(),
            devFsVitePlugin({ configFile: ".bknd/bknd.config.ts" }) as any,
            cloudflare({
               configPath: this.userFs.path(".bknd/wrangler.json"),
               persistState: {
                  path: this.userFs.path(".bknd/state"),
               },
            }),
            injectMain({
               appPath: "./src/App.tsx",
               rootId: "root",
            }),
         ],
         build: {
            minify: true,
         },
         resolve: {
            dedupe: ["react", "react-dom"],
         },
      };
   }

   async build() {
      const builder = await createBuilder(this.getViteConfig());
      await builder.buildApp();
   }

   async listen() {
      await this.server.listen();
      this.server.printUrls();
      this.server.bindCLIShortcuts({ print: true });
   }
}
