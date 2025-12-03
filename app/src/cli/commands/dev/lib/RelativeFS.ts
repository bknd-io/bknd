import {
   mkdir,
   stat,
   readFile as nodeReadFile,
   writeFile as nodeWriteFile,
} from "node:fs/promises";
import { getRootPath } from "cli/utils/sys";
import path from "node:path";

export class RelativeFS {
   public root: string;

   constructor(p: string) {
      this.root = path.resolve(getRootPath(), p);
   }

   path(p: string) {
      return path.join(this.root, p);
   }

   async hasFile(path: string) {
      try {
         const s = await stat(this.path(path));
         return s.isFile();
      } catch (_) {
         return false;
      }
   }

   async hasDir(path: string) {
      try {
         const s = await stat(this.path(path));
         return s.isDirectory();
      } catch (_) {
         return false;
      }
   }

   async readFile(p: string) {
      return await nodeReadFile(this.path(p), "utf-8");
   }

   async writeFile(p: string, content: string) {
      return await nodeWriteFile(this.path(p), content);
   }

   async makeDir(p: string) {
      return await mkdir(this.path(p), { recursive: true });
   }
}
