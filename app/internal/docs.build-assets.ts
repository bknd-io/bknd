import { createApp } from "bknd/adapter/bun";

async function generate() {
   console.info("Generating MCP documentation...");
   const app = await createApp({
      connection: {
         url: ":memory:",
      },
      config: {
         server: {
            mcp: {
               enabled: true,
               path: "/mcp2",
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
   await app.getMcpClient().ping();

   const { tools, resources } = app.mcp!.toJSON();
   await Bun.write("../docs/mcp.json", JSON.stringify({ tools, resources }, null, 2));

   console.info("MCP documentation generated.");
}

void generate();
