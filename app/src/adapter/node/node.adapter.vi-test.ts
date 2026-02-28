import { describe } from "vitest";
import * as node from "./node.adapter";
import { adapterTestSuite } from "adapter/adapter-test-suite";
import { viTestRunner } from "adapter/node/vitest";

describe("node adapter", () => {
   adapterTestSuite(viTestRunner, {
      makeApp: node.createApp,
      makeHandler: node.createHandler,
   });
});
