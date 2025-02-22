import { datetimeStringLocal } from "core/utils";
import colors from "picocolors";

function hasColors() {
   try {
      // biome-ignore lint/style/useSingleVarDeclarator: <explanation>
      const p = process || {},
         argv = p.argv || [],
         env = p.env || {};
      return (
         !(!!env.NO_COLOR || argv.includes("--no-color")) &&
         (!!env.FORCE_COLOR ||
            argv.includes("--color") ||
            p.platform === "win32" ||
            // biome-ignore lint/complexity/useOptionalChain: <explanation>
            ((p.stdout || {}).isTTY && env.TERM !== "dumb") ||
            !!env.CI)
      );
   } catch (e) {
      return false;
   }
}

const originalConsoles = {
   error: console.error,
   warn: console.warn,
   info: console.info,
   log: console.log,
   debug: console.debug
} as typeof console;

function __tty(type: any, args: any[]) {
   const has = hasColors();
   const styles = {
      error: {
         prefix: colors.red,
         args: colors.red
      },
      warn: {
         prefix: colors.yellow,
         args: colors.yellow
      },
      info: {
         prefix: colors.cyan
      },
      log: {
         prefix: colors.dim
      },
      debug: {
         prefix: colors.yellow
      }
   } as const;
   const prefix = styles[type].prefix(`[${type.toUpperCase()}]`);
   const _args = args.map((a) =>
      "args" in styles[type] && has && typeof a === "string" ? styles[type].args(a) : a
   );
   return originalConsoles[type](prefix, colors.gray(datetimeStringLocal()), ..._args);
}

export type TConsoleSeverity = keyof typeof originalConsoles;
const severities = Object.keys(originalConsoles) as TConsoleSeverity[];

let enabled = [...severities];

export function disableConsole(severities: TConsoleSeverity[] = enabled) {
   enabled = enabled.filter((s) => !severities.includes(s));
}

export function enableConsole() {
   enabled = [...severities];
}

export const $console = new Proxy(
   {},
   {
      get: (_, prop) => {
         if (prop in originalConsoles && enabled.includes(prop as TConsoleSeverity)) {
            return (...args: any[]) => __tty(prop, args);
         }
         return () => null;
      }
   }
) as typeof console;

export async function withDisabledConsole<R>(
   fn: () => Promise<R>,
   sev?: TConsoleSeverity[]
): Promise<R> {
   disableConsole(sev);
   try {
      const result = await fn();
      enableConsole();
      return result;
   } catch (e) {
      enableConsole();
      throw e;
   }
}

export function colorizeConsole(con: typeof console) {
   for (const [key] of Object.entries(originalConsoles)) {
      con[key] = $console[key];
   }
}
