import { AppServer, serverConfigSchema } from "modules/server/AppServer";
import { describe, test, expect } from "bun:test";

describe("AppServer", () => {
   test("config", () => {
      {
         const server = new AppServer();
         expect(server).toBeDefined();
         expect(server.config).toEqual({
            cors: {
               allow_credentials: true,
               origin: "*",
               allow_methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
               allow_headers: ["Content-Type", "Content-Length", "Authorization", "Accept"],
            },
         });
      }

      {
         const server = new AppServer({
            cors: {
               origin: "https",
               allow_methods: ["GET", "POST"],
            },
         });
         expect(server).toBeDefined();
         expect(server.config).toEqual({
            cors: {
               allow_credentials: true,
               origin: "https",
               allow_methods: ["GET", "POST"],
               allow_headers: ["Content-Type", "Content-Length", "Authorization", "Accept"],
            },
         });
      }
   });
});
