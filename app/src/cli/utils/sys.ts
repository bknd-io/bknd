import { $console } from "bknd/utils";
import { execSync, exec as nodeExec } from "node:child_process";
import { readFile, writeFile as nodeWriteFile } from "node:fs/promises";
import path from "node:path";
import url from "node:url";

export function getRootPath() {
   const _path = path.dirname(url.fileURLToPath(import.meta.url));
   // because of "src", local needs one more level up
   return path.resolve(_path, process.env.LOCAL ? "../../../" : "../../");
}

export function getDistPath() {
   return path.resolve(getRootPath(), "dist");
}

export function getRelativeDistPath() {
   return path.relative(process.cwd(), getDistPath());
}

export async function getVersion(_path: string = "") {
   try {
      const resolved = path.resolve(getRootPath(), path.join(_path, "package.json"));
      const pkg = await readFile(resolved, "utf-8");
      if (pkg) {
         return JSON.parse(pkg).version ?? "preview";
      }
   } catch (e) {
      console.error("Failed to resolve version");
   }

   return "unknown";
}

export async function fileExists(filePath: string) {
   try {
      await readFile(path.resolve(process.cwd(), filePath));
      return true;
   } catch {
      return false;
   }
}

export async function writeFile(filePath: string, content: string) {
   try {
      await nodeWriteFile(path.resolve(process.cwd(), filePath), content);
      return true;
   } catch (e) {
      $console.error("Failed to write file", e);
      return false;
   }
}

export function exec(command: string, opts?: { silent?: boolean; env?: Record<string, string> }) {
   const stdio = opts?.silent ? "pipe" : "inherit";
   const output = execSync(command, {
      stdio: ["inherit", stdio, stdio],
      env: { ...process.env, ...opts?.env },
   });
   if (!opts?.silent) {
      return;
   }
   return output.toString();
}

export function execAsync(
   command: string,
   opts?: { silent?: boolean; env?: Record<string, string> },
) {
   return new Promise((resolve, reject) => {
      nodeExec(
         command,
         {
            env: { ...process.env, ...opts?.env },
         },
         (err, stdout, stderr) => {
            if (err) {
               return reject(err);
            }
            resolve(stdout);
         },
      );
   });
}
