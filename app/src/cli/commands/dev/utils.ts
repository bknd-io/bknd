import path from "node:path";
import {
   mkdir,
   stat,
   readFile as nodeReadFile,
   writeFile as nodeWriteFile,
} from "node:fs/promises";
import { getRootPath } from "cli/utils/sys";

export const TEMPLATE_PATH = "src/cli/commands/dev/template";
export const currentDir = process.cwd();

export const fs = (dir: string) => {
   const PATH = path.resolve(getRootPath(), dir);
   return {
      PATH,
      path: (_path: string) => path.join(PATH, _path),
      hasFile: async (file: string) => {
         try {
            const s = await stat(path.join(PATH, file));
            return s.isFile();
         } catch (_) {
            return false;
         }
      },
      hasDir: async (_dir: string) => {
         try {
            const s = await stat(path.join(PATH, _dir));
            return s.isDirectory();
         } catch (_) {
            return false;
         }
      },
      readFile: (file: string) => nodeReadFile(path.join(PATH, file), "utf-8"),
      readJsonFile: async (file: string) =>
         JSON.parse(await nodeReadFile(path.join(PATH, file), "utf-8")),
      writeFile: (file: string, content: string) => nodeWriteFile(path.join(PATH, file), content),
      makeDir: (_newDir: string) => mkdir(path.join(PATH, _newDir)),
   };
};
