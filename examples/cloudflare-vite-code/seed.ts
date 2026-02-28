/// <reference types="./worker-configuration.d.ts" />

import { createFrameworkApp } from "bknd/adapter";
import config from "./bknd.config.ts";

const app = await createFrameworkApp(config, {});

const {
   data: { count: usersCount },
} = await app.em.repo("users").count();
const {
   data: { count: todosCount },
} = await app.em.repo("todos").count();

// only run if the database is empty
if (usersCount === 0 && todosCount === 0) {
   await app.em.mutator("todos").insertMany([
      { title: "Learn bknd", done: true },
      { title: "Build something cool", done: false },
   ]);

   await app.module.auth.createUser({
      email: "test@bknd.io",
      password: "12345678",
   });
}

process.exit(0);
