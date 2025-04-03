import { $ } from "bun";
import path from "node:path";
import c from "picocolors";

const basePath = new URL(import.meta.resolve("../../")).pathname.slice(0, -1);

async function run(
   cmd: string[] | string,
   opts: Bun.SpawnOptions.OptionsObject & {},
   onChunk: (chunk: string, resolve: (data: any) => void, reject: (err: Error) => void) => void,
): Promise<{ proc: Bun.Subprocess; data: any }> {
   return new Promise((resolve, reject) => {
      const proc = Bun.spawn(Array.isArray(cmd) ? cmd : cmd.split(" "), {
         ...opts,
         stdout: "pipe",
         stderr: "pipe",
      });

      // Read from stdout
      const reader = proc.stdout.getReader();
      const decoder = new TextDecoder();

      // Function to read chunks
      let resolveCalled = false;
      (async () => {
         try {
            while (true) {
               const { done, value } = await reader.read();
               if (done) break;

               const text = decoder.decode(value);
               if (!resolveCalled) {
                  console.log(c.dim(text.replace(/\n$/, "")));
               }
               onChunk(
                  text,
                  (data) => {
                     resolve({ proc, data });
                     resolveCalled = true;
                  },
                  reject,
               );
            }
         } catch (err) {
            reject(err);
         }
      })();

      proc.exited.then((code) => {
         if (code !== 0 && code !== 130) {
            throw new Error(`Process exited with code ${code}`);
         }
      });
   });
}

const adapters = {
   node: {
      dir: path.join(basePath, "examples/node"),
      clean: async function () {
         const cwd = path.relative(process.cwd(), this.dir);
         await $`cd ${cwd} && rm -rf uploads data.db && mkdir -p uploads`;
      },
      start: async function () {
         return await run(
            "npm run start",
            {
               cwd: this.dir,
            },
            (chunk, resolve, reject) => {
               const regex = /running on (http:\/\/.*)\n/;
               if (regex.test(chunk)) {
                  resolve(chunk.match(regex)?.[1]);
               }
            },
         );
      },
   },
   bun: {
      dir: path.join(basePath, "examples/bun"),
      clean: async function () {
         const cwd = path.relative(process.cwd(), this.dir);
         await $`cd ${cwd} && rm -rf uploads data.db && mkdir -p uploads`;
      },
      start: async function () {
         return await run(
            "npm run start",
            {
               cwd: this.dir,
            },
            (chunk, resolve, reject) => {
               const regex = /running on (http:\/\/.*)\n/;
               if (regex.test(chunk)) {
                  resolve(chunk.match(regex)?.[1]);
               }
            },
         );
      },
   },
   cloudflare: {
      dir: path.join(basePath, "examples/cloudflare-worker"),
      clean: async function () {
         const cwd = path.relative(process.cwd(), this.dir);
         await $`cd ${cwd} && rm -rf .wrangler node_modules/.cache node_modules/.mf`;
      },
      start: async function () {
         return await run(
            "npm run dev",
            {
               cwd: this.dir,
            },
            (chunk, resolve, reject) => {
               const regex = /Ready on (http:\/\/.*)/;
               if (regex.test(chunk)) {
                  resolve(chunk.match(regex)?.[1]);
               }
            },
         );
      },
   },
   "react-router": {
      dir: path.join(basePath, "examples/react-router"),
      clean: async function () {
         const cwd = path.relative(process.cwd(), this.dir);
         await $`cd ${cwd} && rm -rf .react-router data.db`;
         await $`cd ${cwd} && rm -rf public/uploads && mkdir -p public/uploads`;
      },
      start: async function () {
         return await run(
            "npm run dev",
            {
               cwd: this.dir,
            },
            (chunk, resolve, reject) => {
               const regex = /Local.*?(http:\/\/.*)\//;
               if (regex.test(chunk)) {
                  resolve(chunk.match(regex)?.[1]);
               }
            },
         );
      },
   },
   nextjs: {
      dir: path.join(basePath, "examples/nextjs"),
      clean: async function () {
         const cwd = path.relative(process.cwd(), this.dir);
         await $`cd ${cwd} && rm -rf .nextjs data.db`;
         await $`cd ${cwd} && rm -rf public/uploads && mkdir -p public/uploads`;
      },
      start: async function () {
         return await run(
            "npm run dev",
            {
               cwd: this.dir,
            },
            (chunk, resolve, reject) => {
               const regex = /Local.*?(http:\/\/.*)\n/;
               if (regex.test(chunk)) {
                  resolve(chunk.match(regex)?.[1]);
               }
            },
         );
      },
   },
   astro: {
      dir: path.join(basePath, "examples/astro"),
      clean: async function () {
         const cwd = path.relative(process.cwd(), this.dir);
         await $`cd ${cwd} && rm -rf .astro data.db`;
         await $`cd ${cwd} && rm -rf public/uploads && mkdir -p public/uploads`;
      },
      start: async function () {
         return await run(
            "npm run dev",
            {
               cwd: this.dir,
            },
            (chunk, resolve, reject) => {
               const regex = /Local.*?(http:\/\/.*)\//;
               if (regex.test(chunk)) {
                  resolve(chunk.match(regex)?.[1]);
               }
            },
         );
      },
   },
} as const;

for (const [name, config] of Object.entries(adapters)) {
   console.log("adapter", c.cyan(name));
   await config.clean();

   const { proc, data } = await config.start();
   console.log("proc:", proc.pid, "data:", c.cyan(data));
   //proc.kill();process.exit(0);

   await $`TEST_URL=${data} TEST_ADAPTER=${name} bun run test:e2e`;
   console.log("DONE!");

   while (!proc.killed) {
      proc.kill("SIGINT");
      await Bun.sleep(250);
      console.log("Waiting for process to exit...");
   }
   //process.exit(0);
}
