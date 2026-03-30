import { build } from "tsdown";
import c from "picocolors";

export async function buildTypes() {
    await build({
        tsconfig: "tsconfig.build.json",
        watch: false,
        clean: true,
        logLevel: "silent",
        unbundle: true,
        dts: {
            emitDtsOnly: true,
            resolver: "oxc",
        },
    });
}

if (import.meta.main) {
   try {
      await buildTypes();
      console.log(c.cyan("[Types]"), c.green("built"));
   } catch (error) {
      console.error(c.cyan("[Types]"), c.red("build failed"), error);
      process.exitCode = 1;
   }
}