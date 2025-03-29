import { $console } from "core";

type ConsoleSeverity = "log" | "warn" | "error";
const _oldConsoles = {
   log: console.log,
   warn: console.warn,
   error: console.error,
};

export async function withDisabledConsole<R>(
   fn: () => Promise<R>,
   severities: ConsoleSeverity[] = ["log", "warn", "error"],
): Promise<R> {
   const _oldConsoles = {
      log: console.log,
      warn: console.warn,
      error: console.error,
   };
   disableConsoleLog(severities);
   const enable = () => {
      Object.entries(_oldConsoles).forEach(([severity, fn]) => {
         console[severity as ConsoleSeverity] = fn;
      });
   };
   try {
      const result = await fn();
      enable();
      return result;
   } catch (e) {
      enable();
      throw e;
   }
}

export function disableConsoleLog(severities: ConsoleSeverity[] = ["log", "warn"]) {
   severities.forEach((severity) => {
      console[severity] = () => null;
   });
   $console.setLevel("error");
}

export function enableConsoleLog() {
   Object.entries(_oldConsoles).forEach(([severity, fn]) => {
      console[severity as ConsoleSeverity] = fn;
   });
   $console.resetLevel();
}

export function tryit(fn: () => void, fallback?: any) {
   try {
      return fn();
   } catch (e) {
      return fallback || e;
   }
}

export function formatMemoryUsage() {
   const usage = process.memoryUsage();
   return {
      rss: usage.rss / 1024 / 1024,
      heapUsed: usage.heapUsed / 1024 / 1024,
      external: usage.external / 1024 / 1024,
      arrayBuffers: usage.arrayBuffers / 1024 / 1024,
   };
}
