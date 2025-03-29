import { afterAll, beforeAll, describe } from "bun:test";
import * as astro from "./astro.adapter";
import { disableConsoleLog, enableConsoleLog } from "core/utils";
import { adapterTestSuite } from "adapter/adapter-test-suite";
import { bunTestRunner } from "adapter/bun/test";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

describe("astro adapter", () => {
   adapterTestSuite(bunTestRunner, {
      makeApp: astro.getApp,
      makeHandler: (c, a, o) => (request: Request) => astro.serve(c, a, o)({ request }),
   });
});
