import { createWriteStream, readFileSync } from "node:fs";
import { test } from "node:test";
import { Miniflare } from "miniflare";
import { StorageR2Adapter } from "adapter/cloudflare/StorageR2Adapter";
import { adapterTestSuite } from "media";
import { nodeTestRunner } from "adapter/node";
import path from "node:path";

// https://github.com/nodejs/node/issues/44372#issuecomment-1736530480
console.log = async (message: any) => {
   const tty = createWriteStream("/dev/tty");
   const msg = typeof message === "string" ? message : JSON.stringify(message, null, 2);
   return tty.write(`${msg}\n`);
};

test("StorageR2Adapter", async () => {
   const mf = new Miniflare({
      modules: true,
      script: "export default { async fetch() { return new Response(null); } }",
      r2Buckets: ["BUCKET"],
   });

   const bucket = (await mf.getR2Bucket("BUCKET")) as unknown as R2Bucket;
   const adapter = new StorageR2Adapter(bucket);

   const basePath = path.resolve(import.meta.dirname, "../_assets");
   const buffer = readFileSync(path.join(basePath, "image.png"));
   const file = new File([buffer], "image.png", { type: "image/png" });

   await adapterTestSuite(nodeTestRunner, adapter, file);
   await mf.dispose();
});
