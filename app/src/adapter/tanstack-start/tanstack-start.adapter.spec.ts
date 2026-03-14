import { afterAll, beforeAll, describe } from "bun:test";
import * as tanstackStart from "./tanstack-start.adapter";
import { disableConsoleLog, enableConsoleLog } from "core/utils";
import { adapterTestSuite } from "adapter/adapter-test-suite";
import { bunTestRunner } from "adapter/bun/test";
import type { TanstackStartConfig } from "./tanstack-start.adapter";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

describe("tanstack start adapter", () => {
   adapterTestSuite<TanstackStartConfig>(bunTestRunner, {
      makeApp: tanstackStart.getApp,
      makeHandler: tanstackStart.serve,
   });
});
