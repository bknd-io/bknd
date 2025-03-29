import { describe, before, after } from "node:test";
import * as node from "./node.adapter";
import { adapterTestSuite } from "adapter/adapter-test-suite";
import { nodeTestRunner } from "adapter/node";
import { disableConsoleLog, enableConsoleLog } from "core/utils";

before(() => disableConsoleLog());
after(enableConsoleLog);

describe("node adapter", () => {
   adapterTestSuite(nodeTestRunner, {
      makeApp: node.createApp,
      makeHandler: node.createHandler,
   });
});
