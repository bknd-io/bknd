import { describe, test, expect, beforeEach, beforeAll, afterAll } from "bun:test";
import { type App, createApp, createMcpToolCaller } from "core/test/utils";
import { disableConsoleLog, enableConsoleLog } from "core/utils";
import type { McpServer } from "bknd/utils";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

/**
 * - [x] auth_me
 * - [x] auth_strategies
 * - [x] auth_user_create
 * - [x] auth_user_token
 * - [x] auth_user_password_change
 * - [x] auth_user_password_test
 * - [x] config_auth_get
 * - [x] config_auth_update
 * - [x] config_auth_strategies_get
 * - [x] config_auth_strategies_add
 * - [x] config_auth_strategies_update
 * - [x] config_auth_strategies_remove
 * - [x] config_auth_roles_get
 * - [x] config_auth_roles_add
 * - [x] config_auth_roles_update
 * - [x] config_auth_roles_remove
 */
describe("mcp auth", async () => {
   let app: App;
   let server: McpServer;
   beforeEach(async () => {
      app = createApp({
         config: {
            auth: {
               enabled: true,
               jwt: {
                  secret: "secret",
               },
            },
            server: {
               mcp: {
                  enabled: true,
               },
            },
         },
      });
      await app.build();
      await app.getMcpClient().ping();
      server = app.mcp!;
      server.setLogLevel("error");
      server.onNotification((message) => {
         console.dir(message, { depth: null });
      });
   });

   const tool = createMcpToolCaller();

   test("auth_*", async () => {
      const me = await tool(server, "auth_me", {});
      expect(me.user).toBeNull();

      // strategies
      const strategies = await tool(server, "auth_strategies", {});
      expect(Object.keys(strategies.strategies).length).toEqual(1);
      expect(strategies.strategies.password.enabled).toBe(true);

      // create user
      const user = await tool(
         server,
         "auth_user_create",
         {
            email: "test@test.com",
            password: "12345678",
         },
         new Headers(),
      );
      expect(user.email).toBe("test@test.com");

      // create token
      const token = await tool(
         server,
         "auth_user_token",
         {
            email: "test@test.com",
         },
         new Headers(),
      );
      expect(token.token).toBeDefined();
      expect(token.user.email).toBe("test@test.com");

      // me
      const me2 = await tool(
         server,
         "auth_me",
         {},
         new Request("http://localhost", {
            headers: new Headers({
               Authorization: `Bearer ${token.token}`,
            }),
         }),
      );
      expect(me2.user.email).toBe("test@test.com");

      // change password
      const changePassword = await tool(
         server,
         "auth_user_password_change",
         {
            email: "test@test.com",
            password: "87654321",
         },
         new Headers(),
      );
      expect(changePassword.changed).toBe(true);

      // test password
      const testPassword = await tool(
         server,
         "auth_user_password_test",
         {
            email: "test@test.com",
            password: "87654321",
         },
         new Headers(),
      );
      expect(testPassword.valid).toBe(true);
   });

   test("config_auth_{get,update}", async () => {
      expect(await tool(server, "config_auth_get", {})).toEqual({
         path: "",
         secrets: false,
         partial: false,
         value: app.toJSON().auth,
      });

      // update
      await tool(server, "config_auth_update", {
         value: {
            allow_register: false,
         },
      });
      expect(app.toJSON().auth.allow_register).toBe(false);
   });

   test("config_auth_strategies_{get,add,update,remove}", async () => {
      const strategies = await tool(server, "config_auth_strategies_get", {
         key: "password",
      });
      expect(strategies).toEqual({
         secrets: false,
         module: "auth",
         key: "password",
         value: {
            enabled: true,
            type: "password",
         },
      });

      // add google oauth
      const addGoogleOauth = await tool(server, "config_auth_strategies_add", {
         key: "google",
         value: {
            type: "oauth",
            enabled: true,
            config: {
               name: "google",
               type: "oidc",
               client: {
                  client_id: "client_id",
                  client_secret: "client_secret",
               },
            },
         },
         return_config: true,
      });
      expect(addGoogleOauth.config.google.enabled).toBe(true);
      expect(app.toJSON().auth.strategies.google?.enabled).toBe(true);

      // update (disable) google oauth
      await tool(server, "config_auth_strategies_update", {
         key: "google",
         value: {
            enabled: false,
         },
      });
      expect(app.toJSON().auth.strategies.google?.enabled).toBe(false);

      // remove google oauth
      await tool(server, "config_auth_strategies_remove", {
         key: "google",
      });
      expect(app.toJSON().auth.strategies.google).toBeUndefined();
   });

   test("config_auth_roles_{get,add,update,remove}", async () => {
      // add role
      const addGuestRole = await tool(server, "config_auth_roles_add", {
         key: "guest",
         value: {
            permissions: ["read", "write"],
         },
         return_config: true,
      });
      expect(addGuestRole.config.guest.permissions).toEqual(["read", "write"]);

      // update role
      await tool(server, "config_auth_roles_update", {
         key: "guest",
         value: {
            permissions: ["read"],
         },
      });
      expect(app.toJSON().auth.roles?.guest?.permissions).toEqual(["read"]);

      // get role
      const getGuestRole = await tool(server, "config_auth_roles_get", {
         key: "guest",
      });
      expect(getGuestRole.value.permissions).toEqual(["read"]);

      // remove role
      await tool(server, "config_auth_roles_remove", {
         key: "guest",
      });
      expect(app.toJSON().auth.roles?.guest).toBeUndefined();
   });
});
