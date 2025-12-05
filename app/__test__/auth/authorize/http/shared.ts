import { createApp } from "core/test/utils";
import type { CreateAppConfig } from "App";
import type { RoleSchema } from "auth/authorize/Role";
import { isPlainObject } from "core/utils";

export type AuthTestConfig = {
   guest?: RoleSchema;
   member?: RoleSchema;
   authorized?: RoleSchema;
};

export async function createAuthTestApp(
   testConfig: {
      permission: AuthTestConfig | string | string[];
      request: Request;
   },
   config: Partial<CreateAppConfig> = {},
) {
   let member: RoleSchema | undefined;
   let authorized: RoleSchema | undefined;
   let guest: RoleSchema | undefined;
   if (isPlainObject(testConfig.permission)) {
      if (testConfig.permission.guest)
         guest = {
            ...testConfig.permission.guest,
            is_default: true,
         };
      if (testConfig.permission.member) member = testConfig.permission.member;
      if (testConfig.permission.authorized) authorized = testConfig.permission.authorized;
   } else {
      member = {
         permissions: [],
      };
      authorized = {
         permissions: Array.isArray(testConfig.permission)
            ? testConfig.permission
            : [testConfig.permission],
      };
      guest = {
         permissions: [],
         is_default: true,
      };
   }

   console.log("authorized", authorized);

   const app = createApp({
      ...config,
      config: {
         ...config.config,
         auth: {
            ...config.config?.auth,
            enabled: true,
            guard: {
               enabled: true,
               ...config.config?.auth?.guard,
            },
            jwt: {
               ...config.config?.auth?.jwt,
               secret: "secret",
            },
            roles: {
               ...config.config?.auth?.roles,
               guest,
               member,
               authorized,
               admin: {
                  implicit_allow: true,
               },
            },
         },
      },
   });
   await app.build();

   const users = {
      guest: null,
      member: await app.createUser({
         email: "member@test.com",
         password: "12345678",
         role: "member",
      }),
      authorized: await app.createUser({
         email: "authorized@test.com",
         password: "12345678",
         role: "authorized",
      }),
      admin: await app.createUser({
         email: "admin@test.com",
         password: "12345678",
         role: "admin",
      }),
   } as const;

   const tokens = {} as Record<keyof typeof users, string>;
   for (const [key, user] of Object.entries(users)) {
      if (user) {
         tokens[key as keyof typeof users] = await app.module.auth.authenticator.jwt(user);
      }
   }

   async function makeRequest(user: keyof typeof users, input: string, init: RequestInit = {}) {
      const headers = new Headers(init.headers ?? {});
      if (user in tokens) {
         headers.set("Authorization", `Bearer ${tokens[user as keyof typeof tokens]}`);
      }
      const res = await app.server.request(input, {
         ...init,
         headers,
      });

      let data: any;
      if (res.headers.get("Content-Type")?.startsWith("application/json")) {
         data = await res.json();
      } else if (res.headers.get("Content-Type")?.startsWith("text/")) {
         data = await res.text();
      }

      return {
         status: res.status,
         ok: res.ok,
         headers: Object.fromEntries(res.headers.entries()),
         data,
      };
   }

   const requestFn = new Proxy(
      {},
      {
         get(_, prop: keyof typeof users) {
            return async (input: string, init: RequestInit = {}) => {
               return makeRequest(prop, input, init);
            };
         },
      },
   ) as {
      [K in keyof typeof users]: (
         input: string,
         init?: RequestInit,
      ) => Promise<{
         status: number;
         ok: boolean;
         headers: Record<string, string>;
         data: any;
      }>;
   };

   const request = new Proxy(
      {},
      {
         get(_, prop: keyof typeof users) {
            return async () => {
               return makeRequest(prop, testConfig.request.url, {
                  headers: testConfig.request.headers,
                  method: testConfig.request.method,
                  body: testConfig.request.body,
               });
            };
         },
      },
   ) as {
      [K in keyof typeof users]: () => Promise<{
         status: number;
         ok: boolean;
         headers: Record<string, string>;
         data: any;
      }>;
   };

   return { app, users, request, requestFn };
}
