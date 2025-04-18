import type { ModuleConfigs } from "modules/ModuleManager";
import type { OpenAPIV3 as OAS } from "openapi-types";
import * as tbbox from "@sinclair/typebox";
const { Type } = tbbox;

function prefixPaths(paths: OAS.PathsObject, prefix: string): OAS.PathsObject {
   const result: OAS.PathsObject = {};
   for (const [path, pathItem] of Object.entries(paths)) {
      result[`${prefix}${path}`] = pathItem;
   }
   return result;
}

function systemRoutes(config: ModuleConfigs): { paths: OAS.Document["paths"] } {
   const tags = ["system"];
   const paths: OAS.PathsObject = {
      "/ping": {
         get: {
            summary: "Ping",
            responses: {
               "200": {
                  description: "Pong",
                  content: {
                     "application/json": {
                        schema: Type.Object({
                           pong: Type.Boolean({ default: true }),
                        }),
                     },
                  },
               },
            },
            tags,
         },
      },
      "/config": {
         get: {
            summary: "Get config",
            responses: {
               "200": {
                  description: "Config",
                  content: {
                     "application/json": {
                        schema: Type.Object({
                           version: Type.Number() as any,
                           server: Type.Object({}),
                           data: Type.Object({}),
                           auth: Type.Object({}),
                           flows: Type.Object({}),
                           media: Type.Object({}),
                        }),
                     },
                  },
               },
            },
            tags,
         },
      },
      "/schema": {
         get: {
            summary: "Get config",
            responses: {
               "200": {
                  description: "Config",
                  content: {
                     "application/json": {
                        schema: Type.Object({
                           version: Type.Number() as any,
                           schema: Type.Object({
                              server: Type.Object({}),
                              data: Type.Object({}),
                              auth: Type.Object({}),
                              flows: Type.Object({}),
                              media: Type.Object({}),
                           }),
                        }),
                     },
                  },
               },
            },
            tags,
         },
      },
   };

   return { paths: prefixPaths(paths, "/api/system") };
}

function dataRoutes(config: ModuleConfigs): { paths: OAS.Document["paths"] } {
   const schemas = {
      entityData: Type.Object({
         id: Type.Number() as any,
      }),
   };
   const repoManyResponses: OAS.ResponsesObject = {
      "200": {
         description: "List of entities",
         content: {
            "application/json": {
               schema: Type.Array(schemas.entityData),
            },
         },
      },
   };
   const repoSingleResponses: OAS.ResponsesObject = {
      "200": {
         description: "Entity",
         content: {
            "application/json": {
               schema: schemas.entityData,
            },
         },
      },
   };
   const params = {
      entity: {
         name: "entity",
         in: "path",
         required: true,
         schema: Type.String(),
      },
      entityId: {
         name: "id",
         in: "path",
         required: true,
         schema: Type.Number() as any,
      },
   };

   const tags = ["data"];
   const paths: OAS.PathsObject = {
      "/entity/{entity}": {
         get: {
            summary: "List entities",
            parameters: [params.entity],
            responses: repoManyResponses,
            tags,
         },
         post: {
            summary: "Create entity",
            parameters: [params.entity],
            requestBody: {
               content: {
                  "application/json": {
                     schema: Type.Object({}),
                  },
               },
            },
            responses: repoSingleResponses,
            tags,
         },
      },
      "/entity/{entity}/{id}": {
         get: {
            summary: "Get entity",
            parameters: [params.entity, params.entityId],
            responses: repoSingleResponses,
            tags,
         },
         patch: {
            summary: "Update entity",
            parameters: [params.entity, params.entityId],
            requestBody: {
               content: {
                  "application/json": {
                     schema: Type.Object({}),
                  },
               },
            },
            responses: repoSingleResponses,
            tags,
         },
         delete: {
            summary: "Delete entity",
            parameters: [params.entity, params.entityId],
            responses: {
               "200": {
                  description: "Entity deleted",
               },
            },
            tags,
         },
      },
   };

   return { paths: prefixPaths(paths, config.data.basepath!) };
}

function authRoutes(config: ModuleConfigs): { paths: OAS.Document["paths"] } {
   const schemas = {
      user: Type.Object({
         id: Type.String(),
         email: Type.String(),
         name: Type.String(),
      }),
   };

   const tags = ["auth"];
   const paths: OAS.PathsObject = {
      "/password/login": {
         post: {
            summary: "Login",
            requestBody: {
               content: {
                  "application/json": {
                     schema: Type.Object({
                        email: Type.String(),
                        password: Type.String(),
                     }),
                  },
               },
            },
            responses: {
               "200": {
                  description: "User",
                  content: {
                     "application/json": {
                        schema: Type.Object({
                           user: schemas.user,
                        }),
                     },
                  },
               },
            },
            tags,
         },
      },
      "/password/register": {
         post: {
            summary: "Register",
            requestBody: {
               content: {
                  "application/json": {
                     schema: Type.Object({
                        email: Type.String(),
                        password: Type.String(),
                     }),
                  },
               },
            },
            responses: {
               "200": {
                  description: "User",
                  content: {
                     "application/json": {
                        schema: Type.Object({
                           user: schemas.user,
                        }),
                     },
                  },
               },
            },
            tags,
         },
      },
      "/me": {
         get: {
            summary: "Get me",
            responses: {
               "200": {
                  description: "User",
                  content: {
                     "application/json": {
                        schema: Type.Object({
                           user: schemas.user,
                        }),
                     },
                  },
               },
            },
            tags,
         },
      },
      "/strategies": {
         get: {
            summary: "Get auth strategies",
            responses: {
               "200": {
                  description: "Strategies",
                  content: {
                     "application/json": {
                        schema: Type.Object({
                           strategies: Type.Object({}),
                        }),
                     },
                  },
               },
            },
            tags,
         },
      },
   };

   return { paths: prefixPaths(paths, config.auth.basepath!) };
}

export function generateOpenAPI(config: ModuleConfigs): OAS.Document {
   const system = systemRoutes(config);
   const data = dataRoutes(config);
   const auth = authRoutes(config);

   return {
      openapi: "3.1.0",
      info: {
         title: "bknd API",
         version: "0.0.0",
      },
      paths: {
         ...system.paths,
         ...data.paths,
         ...auth.paths,
      },
   };
}
