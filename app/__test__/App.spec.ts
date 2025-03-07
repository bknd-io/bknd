import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { App } from "../src";
import { getDummyConnection } from "./helper";

const { dummyConnection, afterAllCleanup } = getDummyConnection();
afterEach(afterAllCleanup);

describe("App tests", async () => {
   test("boots and pongs", async () => {
      const app = new App(dummyConnection);
      await app.build();

      //expect(await app.data?.em.ping()).toBeTrue();
   });

   /*test.only("what", async () => {
      const app = new App(dummyConnection, {
         auth: {
            enabled: true,
         },
      });
      await app.module.auth.build();
      await app.module.data.build();
      console.log(app.em.entities.map((e) => e.name));
      console.log(await app.em.schema().getDiff());
   });*/
});
