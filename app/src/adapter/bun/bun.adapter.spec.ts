import { afterAll, beforeAll, describe } from "bun:test";
import * as bun from "./bun.adapter";
import { disableConsoleLog, enableConsoleLog } from "core/utils";
import { adapterTestSuite } from "adapter/adapter-test-suite";
import { bunTestRunner } from "adapter/bun/test";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

describe("bun adapter", () => {
   adapterTestSuite(bunTestRunner, {
      makeApp: bun.createApp,
      makeHandler: bun.createHandler,
   });
});
