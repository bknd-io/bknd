import { afterAll, beforeAll, describe } from "bun:test";
import * as sveltekit from "./sveltekit.adapter";
import { disableConsoleLog, enableConsoleLog } from "core/utils";
import { adapterTestSuite } from "adapter/adapter-test-suite";
import { bunTestRunner } from "adapter/bun/test";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

describe("sveltekit adapter", () => {
   adapterTestSuite(bunTestRunner, {
      makeApp: (c, a) => sveltekit.getApp(c as any, a ?? ({} as any)),
      makeHandler: (c, a) => (request: Request) =>
         sveltekit.serve(c as any, a ?? ({} as any))({ request }),
   });
});
