import { afterAll, beforeAll, describe, expect, jest, test } from "bun:test";
import { FetchTask, Flow } from "../../src/flows";

let _oldFetch: typeof fetch;
function mockFetch(responseMethods: Partial<Response>) {
   _oldFetch = global.fetch;
   // @ts-ignore
   global.fetch = jest.fn(() => Promise.resolve(responseMethods));
}

function mockFetch2(newFetch: (input: RequestInfo, init: RequestInit) => Promise<Response>) {
   _oldFetch = global.fetch;
   // @ts-ignore
   global.fetch = jest.fn(newFetch);
}

function unmockFetch() {
   global.fetch = _oldFetch;
}

beforeAll(() =>
   /*mockFetch({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ todos: [1, 2] })
   })*/
   mockFetch2(async (input, init) => {
      const request = {
         url: String(input),
         method: init?.method ?? "GET",
         // @ts-ignore
         headers: Object.fromEntries(init?.headers?.entries() ?? []),
         body: init?.body,
      };

      return new Response(JSON.stringify({ todos: [1, 2], request }), {
         status: 200,
         headers: { "Content-Type": "application/json" },
      });
   }),
);
afterAll(unmockFetch);

describe.skip("FetchTask", async () => {
   test("Simple fetch", async () => {
      const task = new FetchTask("Fetch Something", {
         url: "https://jsonplaceholder.typicode.com/todos/1",
         method: "GET",
         headers: [{ key: "Content-Type", value: "application/json" }],
      });

      const result = await task.run();
      //console.log("result", result);
      expect(result.output!.todos).toEqual([1, 2]);
      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
   });

   test("verify config", async () => {
      // // @ts-expect-error
      expect(() => new FetchTask("", {})).toThrow();

      expect(
         // // @ts-expect-error
         () => new FetchTask("", { url: "https://jsonplaceholder.typicode.com", method: 1 }),
      ).toThrow();

      expect(
         new FetchTask("", {
            url: "https://jsonplaceholder.typicode.com",
            method: "invalid",
         }).execute(),
      ).rejects.toThrow(/^Invalid method/);

      expect(
         () => new FetchTask("", { url: "https://jsonplaceholder.typicode.com", method: "GET" }),
      ).toBeDefined();

      expect(() => new FetchTask("", { url: "", method: "Invalid" })).toThrow();
   });

   test("template", async () => {
      const task = new FetchTask("fetch", {
         url: "https://example.com/?email={{ flow.output.email }}",
         method: "{{ flow.output.method }}",
         headers: [
            { key: "Content-{{ flow.output.headerKey }}", value: "application/json" },
            { key: "Authorization", value: "Bearer {{ flow.output.apiKey }}" },
         ],
         body: JSON.stringify({
            email: "{{ flow.output.email }}",
         }),
      });
      const inputs = {
         headerKey: "Type",
         apiKey: 123,
         email: "what@else.com",
         method: "PATCH",
      };

      const flow = new Flow("", [task]);
      const exec = await flow.start(inputs);
      console.log("errors", exec.getErrors());
      expect(exec.hasErrors()).toBe(false);

      const { request } = exec.getResponse();

      expect(request.url).toBe(`https://example.com/?email=${inputs.email}`);
      expect(request.method).toBe(inputs.method);
      expect(request.headers["content-type"]).toBe("application/json");
      expect(request.headers.authorization).toBe(`Bearer ${inputs.apiKey}`);
      expect(request.body).toBe(JSON.stringify({ email: inputs.email }));
   });
});
