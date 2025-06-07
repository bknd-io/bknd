// placeholder, run generation again
declare namespace Cloudflare {
   interface Env {
      BUCKET: R2Bucket;
      DB: D1Database;
   }
}
interface Env extends Cloudflare.Env {}
