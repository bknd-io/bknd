import nodeAssert from "node:assert/strict";
import { test } from "node:test";
import type { Matcher, Test, TestFn, TestRunner } from "core/test";

const nodeTestMatcher = <T = unknown>(actual: T, parentFailMsg?: string) =>
   ({
      toEqual: (expected: T, failMsg = parentFailMsg) => {
         nodeAssert.deepEqual(actual, expected, failMsg);
      },
      toBe: (expected: T, failMsg = parentFailMsg) => {
         nodeAssert.strictEqual(actual, expected, failMsg);
      },
      toBeString: (failMsg = parentFailMsg) => {
         nodeAssert.strictEqual(typeof actual, "string", failMsg);
      },
      toBeUndefined: (failMsg = parentFailMsg) => {
         nodeAssert.strictEqual(actual, undefined, failMsg);
      },
      toBeDefined: (failMsg = parentFailMsg) => {
         nodeAssert.notStrictEqual(actual, undefined, failMsg);
      },
      toBeOneOf: (expected: T | Array<T> | Iterable<T>, failMsg = parentFailMsg) => {
         const e = Array.isArray(expected) ? expected : [expected];
         nodeAssert.ok(e.includes(actual), failMsg);
      },
   }) satisfies Matcher<T>;

const nodeTestResolverProxy = <T = unknown>(
   actual: Promise<T>,
   handler: { resolve?: any; reject?: any },
) => {
   return new Proxy(
      {},
      {
         get: (_, prop) => {
            if (prop === "then") {
               return actual.then(handler.resolve, handler.reject);
            }
            return actual;
         },
      },
   ) as Matcher<Awaited<T>>;
};

function nodeTest(label: string, fn: TestFn, options?: any) {
   return test(label, fn as any);
}
nodeTest.if = (condition: boolean): Test => {
   if (condition) {
      return nodeTest;
   }
   return (() => {}) as any;
};
nodeTest.skip = (label: string, fn: TestFn) => {
   return test.skip(label, fn as any);
};
nodeTest.skipIf = (condition: boolean): Test => {
   if (condition) {
      return (() => {}) as any;
   }
   return nodeTest;
};

export const nodeTestRunner: TestRunner = {
   test: nodeTest,
   expect: <T = unknown>(actual?: T, failMsg?: string) => ({
      ...nodeTestMatcher(actual, failMsg),
      resolves: nodeTestResolverProxy(actual as Promise<T>, {
         resolve: (r) => nodeTestMatcher(r, failMsg),
      }),
      rejects: nodeTestResolverProxy(actual as Promise<T>, {
         reject: (r) => nodeTestMatcher(r, failMsg),
      }),
   }),
};
