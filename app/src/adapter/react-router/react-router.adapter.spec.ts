import { afterAll, beforeAll, describe } from "bun:test";
import * as rr from "./react-router.adapter";
import { disableConsoleLog, enableConsoleLog } from "core/utils";
import { adapterTestSuite } from "adapter/adapter-test-suite";
import { bunTestRunner } from "adapter/bun/test";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

describe("react-router adapter", () => {
   adapterTestSuite(bunTestRunner, {
      makeApp: rr.getApp,
      makeHandler: (c, a, o) => (request: Request) => rr.serve(c, a?.env, o)({ request }),
   });
});
