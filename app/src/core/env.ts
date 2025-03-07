export type Env = {};

export const is_toggled = (given: unknown): boolean => {
   return typeof given === "string" ? [1, "1", "true"].includes(given) : Boolean(given);
};

export function isDebug(): boolean {
   try {
      // @ts-expect-error - this is a global variable in dev
      return is_toggled(__isDev);
   } catch (e) {
      return false;
   }
}

const envs = {
   // used in $console to determine the log level
   cli_log_level: {
      key: "BKND_CLI_LOG_LEVEL",
      validate: (v: unknown) => {
         if (
            typeof v === "string" &&
            ["log", "info", "warn", "error", "debug"].includes(v.toLowerCase())
         ) {
            return v.toLowerCase() as keyof typeof console;
         }
         return undefined;
      },
   },
   // cli create, determine ref to download template
   cli_create_ref: {
      key: "BKND_CLI_CREATE_REF",
      validate: (v: unknown) => {
         return typeof v === "string" ? v : undefined;
      },
   },
   // module manager debug: {
   modules_debug: {
      key: "BKND_MODULES_DEBUG",
      validate: is_toggled,
   },
} as const;

export const env = <
   Key extends keyof typeof envs,
   Fallback = any,
   R = ReturnType<(typeof envs)[Key]["validate"]>,
>(
   key: Key,
   fallback?: Fallback,
   opts?: {
      source?: any;
      onFallback?: (given: unknown) => void;
      onValid?: (valid: R) => void;
   },
): R extends undefined ? Fallback : R => {
   try {
      const source = opts?.source ?? process.env;
      const c = envs[key];
      const g = source[c.key];
      const v = c.validate(g) as any;
      if (typeof v !== "undefined") {
         opts?.onValid?.(v);
         return v;
      }
      opts?.onFallback?.(g);
   } catch (e) {
      opts?.onFallback?.(undefined);
   }

   return fallback as any;
};
