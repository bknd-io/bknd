import type { MaybePromise } from "core/types";

export type Matcher<T = unknown> = {
   toEqual: (expected: T, failMsg?: string) => void;
   toBe: (expected: T, failMsg?: string) => void;
   toBeUndefined: (failMsg?: string) => void;
   toBeString: (failMsg?: string) => void;
   toBeOneOf: (expected: T | Array<T> | Iterable<T>, failMsg?: string) => void;
   toBeDefined: (failMsg?: string) => void;
   toHaveBeenCalled: (failMsg?: string) => void;
   toHaveBeenCalledTimes: (expected: number, failMsg?: string) => void;
};
export type TestFn = (() => void | Promise<unknown>) | ((done: (err?: unknown) => void) => void);
export interface Test {
   (label: string, fn: TestFn, options?: any): void;
   if: (condition: boolean) => (label: string, fn: TestFn, options?: any) => void;
   skip: (label: string, fn: () => void) => void;
   skipIf: (condition: boolean) => (label: string, fn: TestFn) => void;
}
export type TestRunner = {
   describe: (label: string, asyncFn: () => MaybePromise<void>) => void;
   test: Test;
   mock: <T extends (...args: any[]) => any>(fn: T) => T | any;
   expect: <T = unknown>(
      actual?: T,
      failMsg?: string,
   ) => Matcher<T> & {
      resolves: Matcher<Awaited<T>>;
      rejects: Matcher<Awaited<T>>;
   };
   beforeEach: (fn: () => MaybePromise<void>) => void;
   afterEach: (fn: () => MaybePromise<void>) => void;
   afterAll: (fn: () => MaybePromise<void>) => void;
};

export async function retry<T>(
   fn: () => Promise<T>,
   condition: (result: T) => boolean,
   retries: number,
   delay: number,
): Promise<T> {
   let lastError: Error | null = null;
   for (let i = 0; i < retries; i++) {
      try {
         const result = await fn();
         if (condition(result)) {
            return result;
         } else {
            await new Promise((resolve) => setTimeout(resolve, delay));
         }
      } catch (error) {
         lastError = error as Error;
         await new Promise((resolve) => setTimeout(resolve, delay));
      }
   }
   throw lastError;
}
