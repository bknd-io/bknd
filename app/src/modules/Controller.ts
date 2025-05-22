import type { App } from "App";
import { type Context, type Env, Hono } from "hono";
import * as middlewares from "modules/middlewares";
import type { SafeUser } from "auth";

export type ServerEnv = Env & {
   Variables: {
      app: App;
      // to prevent resolving auth multiple times
      auth?: {
         resolved: boolean;
         registered: boolean;
         skip: boolean;
         user?: SafeUser;
      };
      html?: string;
   };
};

export class Controller {
   protected middlewares = middlewares;

   protected create(): Hono<ServerEnv> {
      return Controller.createServer();
   }

   static createServer(): Hono<ServerEnv> {
      return new Hono<ServerEnv>();
   }

   getController(): Hono<ServerEnv> {
      return this.create();
   }

   protected isJsonRequest(c: Context<ServerEnv>) {
      return (
         c.req.header("Content-Type") === "application/json" ||
         c.req.header("Accept") === "application/json"
      );
   }

   protected notFound(c: Context<ServerEnv>) {
      if (this.isJsonRequest(c)) {
         return c.json({ error: "Not found" }, 404);
      }

      return c.notFound();
   }
}
