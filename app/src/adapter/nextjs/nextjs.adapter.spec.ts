import { afterAll, beforeAll, describe } from "bun:test";
import * as nextjs from "./nextjs.adapter";
import { disableConsoleLog, enableConsoleLog } from "core/utils";
import { adapterTestSuite } from "adapter/adapter-test-suite";
import { bunTestRunner } from "adapter/bun/test";
import type { NextjsBkndConfig } from "./nextjs.adapter";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

describe("nextjs adapter", () => {
   adapterTestSuite<NextjsBkndConfig>(bunTestRunner, {
      makeApp: nextjs.getApp,
      makeHandler: nextjs.serve,
   });
});
