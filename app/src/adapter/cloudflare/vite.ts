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
} = {}): any {
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
         if (!isDev) {
            verbose && console.debug("[dev-fs-plugin] Not in dev mode, skipping");
            return;
         }

         // Track active chunked requests
         const activeRequests = new Map<
            string,
            {
               totalChunks: number;
               filename: string;
               chunks: string[];
               receivedChunks: number;
            }
         >();

         // Intercept stdout to watch for our write requests
         const originalStdoutWrite = process.stdout.write;
         process.stdout.write = function (chunk: any, encoding?: any, callback?: any) {
            const output = chunk.toString();

            // Skip our own debug output
            if (output.includes("[dev-fs-plugin]") || output.includes("[dev-fs-polyfill]")) {
               // @ts-ignore
               // biome-ignore lint/style/noArguments: <explanation>
               return originalStdoutWrite.apply(process.stdout, arguments);
            }

            // Track if we process any protocol messages (to suppress output)
            let processedProtocolMessage = false;

            // Process all start markers in this output
            if (output.includes("{{DEV_FS_START}}")) {
               const startMatches = [
                  ...output.matchAll(/{{DEV_FS_START}} ([a-z0-9]+) (\d+) (.+)/g),
               ];
               for (const startMatch of startMatches) {
                  const requestId = startMatch[1];
                  const totalChunks = Number.parseInt(startMatch[2]);
                  const filename = startMatch[3];

                  activeRequests.set(requestId, {
                     totalChunks,
                     filename,
                     chunks: new Array(totalChunks),
                     receivedChunks: 0,
                  });

                  verbose &&
                     console.debug(
                        `[dev-fs-plugin] Started request ${requestId} for ${filename} (${totalChunks} chunks)`,
                     );
               }
               processedProtocolMessage = true;
            }

            // Process all chunk data in this output
            if (output.includes("{{DEV_FS_CHUNK}}")) {
               const chunkMatches = [
                  ...output.matchAll(/{{DEV_FS_CHUNK}} ([a-z0-9]+) (\d+) ([A-Za-z0-9+/=]+)/g),
               ];
               for (const chunkMatch of chunkMatches) {
                  const requestId = chunkMatch[1];
                  const chunkIndex = Number.parseInt(chunkMatch[2]);
                  const chunkData = chunkMatch[3];

                  const request = activeRequests.get(requestId);
                  if (request) {
                     request.chunks[chunkIndex] = chunkData;
                     request.receivedChunks++;
                     verbose &&
                        console.debug(
                           `[dev-fs-plugin] Received chunk ${chunkIndex}/${request.totalChunks - 1} for ${request.filename} (length: ${chunkData.length})`,
                        );

                     // Validate base64 chunk
                     if (chunkData.length < 1000 && chunkIndex < request.totalChunks - 1) {
                        verbose &&
                           console.warn(
                              `[dev-fs-plugin] WARNING: Chunk ${chunkIndex} seems truncated (length: ${chunkData.length})`,
                           );
                     }
                  }
               }
               processedProtocolMessage = true;
            }

            // Process all end markers in this output
            if (output.includes("{{DEV_FS_END}}")) {
               const endMatches = [...output.matchAll(/{{DEV_FS_END}} ([a-z0-9]+)/g)];
               for (const endMatch of endMatches) {
                  const requestId = endMatch[1];
                  const request = activeRequests.get(requestId);

                  if (request && request.receivedChunks === request.totalChunks) {
                     try {
                        // Reconstruct the base64 string
                        const fullBase64 = request.chunks.join("");
                        verbose &&
                           console.debug(
                              `[dev-fs-plugin] Reconstructed ${request.filename} - base64 length: ${fullBase64.length}`,
                           );

                        // Decode and parse
                        const decodedJson = atob(fullBase64);
                        const writeRequest = JSON.parse(decodedJson);

                        if (writeRequest.type === "DEV_FS_WRITE_REQUEST") {
                           verbose &&
                              console.debug(
                                 `[dev-fs-plugin] Processing write request for ${writeRequest.filename}`,
                              );

                           // Process the write request
                           (async () => {
                              try {
                                 const fullPath = resolve(projectRoot, writeRequest.filename);
                                 verbose &&
                                    console.debug(`[dev-fs-plugin] Writing to: ${fullPath}`);
                                 await nodeWriteFile(fullPath, writeRequest.data);
                                 verbose &&
                                    console.debug("[dev-fs-plugin] File written successfully!");
                              } catch (error) {
                                 console.error("[dev-fs-plugin] Error writing file:", error);
                              }
                           })();

                           // Clean up
                           activeRequests.delete(requestId);
                           return true;
                        }
                     } catch (error) {
                        console.error(
                           "[dev-fs-plugin] Error processing chunked request:",
                           String(error),
                        );
                        activeRequests.delete(requestId);
                     }
                  } else if (request) {
                     verbose &&
                        console.debug(
                           `[dev-fs-plugin] Request ${requestId} incomplete: ${request.receivedChunks}/${request.totalChunks} chunks`,
                        );
                  }
               }
               processedProtocolMessage = true;
            }

            // If we processed any protocol messages, suppress output
            if (processedProtocolMessage) {
               return callback ? callback() : true;
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
         //if (!isDev || !options?.ssr) return;
         if (!isDev) {
            return;
         }

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
      ${verbose ? "console.debug('[dev-fs-polyfill] Intercepting write request for', filename);" : ""}
      
      // Use console logging as a communication channel
      // The main process will watch for this specific log pattern
      const writeRequest = {
        type: 'DEV_FS_WRITE_REQUEST',
        filename: filename,
        data: data,
        timestamp: Date.now()
      };
      
      // Output as a specially formatted console message with end delimiter
      // Base64 encode the JSON to avoid any control character issues
      const jsonString = JSON.stringify(writeRequest);
      const encodedJson = btoa(jsonString);
      
      // Split into reasonable chunks that balance performance vs reliability  
      const chunkSize = 2000; // 2KB chunks - safe for most environments
      const chunks = [];
      for (let i = 0; i < encodedJson.length; i += chunkSize) {
        chunks.push(encodedJson.slice(i, i + chunkSize));
      }
      
      const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      
      // Send start marker (use stdout.write to avoid console display)
      process.stdout.write('{{DEV_FS_START}} ' + requestId + ' ' + chunks.length + ' ' + filename + '\\n');
      
      // Send each chunk
      chunks.forEach((chunk, index) => {
        process.stdout.write('{{DEV_FS_CHUNK}} ' + requestId + ' ' + index + ' ' + chunk + '\\n');
      });
      
      // Send end marker
      process.stdout.write('{{DEV_FS_END}} ' + requestId + '\\n');
      
      return Promise.resolve();
    }
  };
}`;
            return polyfill + code;
         } else {
            verbose && console.debug("[dev-fs-plugin] Not transforming", id);
         }
      },
   } satisfies Plugin;
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
