import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getVersion as sysGetVersion } from "cli/utils/sys";

export type TPackageJson = Partial<{
   name: string;
   main: string;
   version: string;
   scripts: Record<string, string>;
   dependencies: Record<string, string | undefined>;
   devDependencies: Record<string, string | undefined>;
   optionalDependencies: Record<string, string | undefined>;
   [key: string]: any;
}>;

export async function overrideJson<File extends object = object>(
   file: string,
   fn: (pkg: File) => Promise<File> | File,
   opts?: { dir?: string; indent?: number },
) {
   const pkgPath = path.resolve(opts?.dir ?? process.cwd(), file);
   const pkg = await readFile(pkgPath, "utf-8");
   const newPkg = await fn(JSON.parse(pkg));
   await writeFile(pkgPath, JSON.stringify(newPkg, null, opts?.indent || 2));
}

export async function upsertEnvFile(
   kv: Record<string, string | number>,
   opts?: { dir?: string; file?: string },
) {
   const file = opts?.file ?? ".env";
   const envPath = path.resolve(opts?.dir ?? process.cwd(), file);
   const current: Record<string, string | number> = {};

   try {
      const values = await readFile(envPath, "utf-8");
      const lines = values.split("\n");
      for (const line of lines) {
         const [key, value] = line.split("=");
         if (key && value) {
            current[key] = value;
         }
      }
   } catch (e) {
      await writeFile(envPath, "");
   }

   const newEnv = { ...current, ...kv };
   const lines = Object.entries(newEnv).map(([key, value]) => `${key}=${value}`);
   await writeFile(envPath, lines.join("\n"));
}

export async function overridePackageJson(
   fn: (pkg: TPackageJson) => Promise<TPackageJson> | TPackageJson,
   opts?: { dir?: string },
) {
   return await overrideJson("package.json", fn, { dir: opts?.dir });
}

export async function getPackageInfo(pkg: string, version?: string): Promise<TPackageJson> {
   const res = await fetch(`https://registry.npmjs.org/${pkg}${version ? `/${version}` : ""}`);
   return await res.json();
}

export async function getVersion(pkg: string, version: string = "latest") {
   const info = await getPackageInfo(pkg, version);
   return info.version;
}

const _deps = ["dependencies", "devDependencies", "optionalDependencies"] as const;
export async function replacePackageJsonVersions(
   fn: (pkg: string, version: string) => Promise<string | undefined> | string | undefined,
   opts?: { include?: (keyof typeof _deps)[]; dir?: string },
) {
   const deps = (opts?.include ?? _deps) as string[];
   await overridePackageJson(
      async (json) => {
         for (const dep of deps) {
            if (dep in json) {
               for (const [pkg, version] of Object.entries(json[dep])) {
                  const newVersion = await fn(pkg, version as string);
                  if (newVersion) {
                     json[dep][pkg] = newVersion;
                  }
               }
            }
         }

         return json;
      },
      { dir: opts?.dir },
   );
}

export async function updateBkndPackages(dir?: string, map?: Record<string, string>) {
   const versions = {
      bknd: await sysGetVersion(),
      ...(map ?? {}),
   };
   await replacePackageJsonVersions(
      async (pkg) => {
         if (pkg in versions) {
            return versions[pkg];
         }
         return;
      },
      { dir },
   );
}
