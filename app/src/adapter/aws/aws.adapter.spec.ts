import { afterAll, beforeAll, describe } from "bun:test";
import * as awsLambda from "./aws-lambda.adapter";
import { disableConsoleLog, enableConsoleLog } from "core/utils";
import { adapterTestSuite } from "adapter/adapter-test-suite";
import { bunTestRunner } from "adapter/bun/test";

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

describe("aws adapter", () => {
   adapterTestSuite(bunTestRunner, {
      makeApp: awsLambda.createApp,
      // @todo: add a request to lambda event translator?
      makeHandler: (c, a, o) => async (request: Request) => {
         const app = await awsLambda.createApp(c, a, o);
         return app.fetch(request);
      },
   });
});
