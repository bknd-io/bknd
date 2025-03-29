import { serve } from "bknd/adapter/aws";

export const handler = serve({
   // to get local assets, run `npx bknd copy-assets`
   // this is automatically done in `deploy.sh`
   assets: {
      mode: "local",
      root: "./static",
   },
   connection: {
      url: process.env.DB_URL,
      authToken: process.env.DB_TOKEN,
   },
});
