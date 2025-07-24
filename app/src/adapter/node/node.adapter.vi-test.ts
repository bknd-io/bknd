import { describe, beforeAll, afterAll } from "vitest";
import * as node from "./node.adapter";
import { adapterTestSuite } from "adapter/adapter-test-suite";
import { viTestRunner } from "adapter/node/vitest";
import { disableConsoleLog, enableConsoleLog } from "core/utils";

beforeAll(() => disableConsoleLog());
afterAll(enableConsoleLog);

describe("node adapter", () => {
   adapterTestSuite(viTestRunner, {
      makeApp: node.createApp,
      makeHandler: node.createHandler,
   });
});
