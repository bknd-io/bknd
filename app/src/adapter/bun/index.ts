export * from "./bun.adapter";
export * from "../node/storage";
export * from "./connection/BunSqliteConnection";

export async function writer(path: string, content: string) {
   await Bun.write(path, content);
}

export async function reader(path: string) {
   return await Bun.file(path).text();
}
