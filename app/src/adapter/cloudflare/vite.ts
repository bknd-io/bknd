import type { Plugin } from "vite";
import { writeFile as nodeWriteFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Vite plugin that provides Node.js filesystem access during development
 * by injecting a polyfill into the SSR environment
 */
export function devFsVitePlugin({
   verbose = false,
   configFile = "bknd.config.ts",
}: {
   verbose?: boolean;
   configFile?: string;
}): Plugin {
   let isDev = false;
   let projectRoot = "";

   return {
      name: "dev-fs-plugin",
      enforce: "pre",
      configResolved(config) {
         isDev = config.command === "serve";
         projectRoot = config.root;
      },
      configureServer(server) {
         if (!isDev) return;

         // Intercept stdout to watch for our write requests
         const originalStdoutWrite = process.stdout.write;
         process.stdout.write = function (chunk: any, encoding?: any, callback?: any) {
            const output = chunk.toString();

            // Check if this output contains our special write request
            if (output.includes("{{DEV_FS_WRITE_REQUEST}}")) {
               try {
                  // Extract the JSON from the log line
                  const match = output.match(/{{DEV_FS_WRITE_REQUEST}} ({.*})/);
                  if (match) {
                     const writeRequest = JSON.parse(match[1]);
                     if (writeRequest.type === "DEV_FS_WRITE_REQUEST") {
                        if (verbose) {
                           console.debug("[dev-fs-plugin] Intercepted write request via stdout");
                        }

                        // Process the write request immediately
                        (async () => {
                           try {
                              const fullPath = resolve(projectRoot, writeRequest.filename);
                              await nodeWriteFile(fullPath, writeRequest.data);
                              if (verbose) {
                                 console.debug("[dev-fs-plugin] File written successfully!");
                              }
                           } catch (error) {
                              console.error("[dev-fs-plugin] Error writing file:", error);
                           }
                        })();

                        // Don't output the raw write request to console
                        return true;
                     }
                  }
               } catch (error) {
                  // Not a valid write request, continue with normal output
               }
            }

            // @ts-ignore
            // biome-ignore lint:
            return originalStdoutWrite.apply(process.stdout, arguments);
         };

         // Restore stdout when server closes
         server.httpServer?.on("close", () => {
            process.stdout.write = originalStdoutWrite;
         });
      },
      // @ts-ignore
      transform(code, id, options) {
         // Only transform in SSR mode during development
         if (!isDev || !options?.ssr) return;

         // Check if this is the bknd config file
         if (id.includes(configFile)) {
            if (verbose) {
               console.debug("[dev-fs-plugin] Transforming", configFile);
            }

            // Inject our filesystem polyfill at the top of the file
            const polyfill = `
// Dev-fs polyfill injected by vite-plugin-dev-fs
if (typeof globalThis !== 'undefined') {
  globalThis.__devFsPolyfill = {
    writeFile: async (filename, data) => {
      ${verbose ? "console.debug('dev-fs polyfill: Intercepting write request for', filename);" : ""}
      
      // Use console logging as a communication channel
      // The main process will watch for this specific log pattern
      const writeRequest = {
        type: 'DEV_FS_WRITE_REQUEST',
        filename: filename,
        data: data,
        timestamp: Date.now()
      };
      
      // Output as a specially formatted console message
      console.log('{{DEV_FS_WRITE_REQUEST}}', JSON.stringify(writeRequest));
      ${verbose ? "console.debug('dev-fs polyfill: Write request sent via console');" : ""}
      
      return Promise.resolve();
    }
  };
}
`;
            return polyfill + code;
         }
      },
   };
}

// Write function that uses the dev-fs polyfill injected by our Vite plugin
export async function devFsWrite(filename: string, data: string): Promise<void> {
   try {
      // Check if the dev-fs polyfill is available (injected by our Vite plugin)
      if (typeof globalThis !== "undefined" && (globalThis as any).__devFsPolyfill) {
         return (globalThis as any).__devFsPolyfill.writeFile(filename, data);
      }

      // Fallback to Node.js fs for other environments (Node.js, Bun)
      const { writeFile } = await import("node:fs/promises");
      return writeFile(filename, data);
   } catch (error) {
      console.error("[dev-fs-write] Error writing file:", error);
   }
}
