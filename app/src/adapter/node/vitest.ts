import type { TestFn, TestRunner, Test } from "core/test";
import { describe, test, expect, vi } from "vitest";

function vitestTest(label: string, fn: TestFn, options?: any) {
   return test(label, fn as any);
}
vitestTest.if = (condition: boolean): Test => {
   if (condition) {
      return vitestTest;
   }
   return (() => {}) as any;
};
vitestTest.skip = (label: string, fn: TestFn) => {
   return test.skip(label, fn as any);
};
vitestTest.skipIf = (condition: boolean): Test => {
   if (condition) {
      return (() => {}) as any;
   }
   return vitestTest;
};

const vitestExpect = <T = unknown>(actual: T, parentFailMsg?: string) => {
   return {
      toEqual: (expected: T, failMsg = parentFailMsg) => {
         expect(actual, failMsg).toEqual(expected);
      },
      toBe: (expected: T, failMsg = parentFailMsg) => {
         expect(actual, failMsg).toBe(expected);
      },
      toBeString: () => expect(typeof actual, parentFailMsg).toBe("string"),
      toBeUndefined: () => expect(actual, parentFailMsg).toBeUndefined(),
      toBeDefined: () => expect(actual, parentFailMsg).toBeDefined(),
      toBeOneOf: (expected: T | Array<T> | Iterable<T>, failMsg = parentFailMsg) => {
         const e = Array.isArray(expected) ? expected : [expected];
         expect(actual, failMsg).toBeOneOf(e);
      },
      toHaveBeenCalled: () => expect(actual, parentFailMsg).toHaveBeenCalled(),
      toHaveBeenCalledTimes: (expected: number, failMsg = parentFailMsg) => {
         expect(actual, failMsg).toHaveBeenCalledTimes(expected);
      },
   };
};

export const viTestRunner: TestRunner = {
   describe,
   test: vitestTest,
   expect: vitestExpect as any,
   mock: (fn) => vi.fn(fn),
};
