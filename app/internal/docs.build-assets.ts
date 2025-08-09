import { createApp } from "bknd/adapter/bun";

async function generate() {
   console.info("Generating MCP documentation...");
   const app = await createApp({
      initialConfig: {
         server: {
            mcp: {
               enabled: true,
            },
         },
         auth: {
            enabled: true,
         },
         media: {
            enabled: true,
            adapter: {
               type: "local",
               config: {
                  path: "./",
               },
            },
         },
      },
   });
   await app.build();

   const res = await app.server.request("/mcp?explain=1");
   const { tools, resources } = await res.json();
   await Bun.write("../docs/mcp.json", JSON.stringify({ tools, resources }, null, 2));

   console.info("MCP documentation generated.");
}

void generate();
