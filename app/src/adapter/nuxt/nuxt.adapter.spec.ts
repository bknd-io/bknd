import { afterAll, beforeAll, describe } from "bun:test";
import * as nuxt from "./nuxt.adapter";
import { disableConsoleLog, enableConsoleLog } from "core/utils";
import { adapterTestSuite } from "adapter/adapter-test-suite";
import { bunTestRunner } from "adapter/bun/test";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

describe("nuxt adapter", () => {
   adapterTestSuite(bunTestRunner, {
      makeApp: nuxt.getApp,
      makeHandler: nuxt.serve,
   });
});
