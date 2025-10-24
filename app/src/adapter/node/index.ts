import { readFile, writeFile } from "node:fs/promises";

export * from "./node.adapter";
export * from "./storage";
export * from "./connection/NodeSqliteConnection";

export async function writer(path: string, content: string) {
   await writeFile(path, content);
}

export async function reader(path: string) {
   return await readFile(path, "utf-8");
}
