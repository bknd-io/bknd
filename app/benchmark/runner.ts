import { run } from "mitata";

export type BenchmarkModule = {
   id: string;
   register: () => void;
};

export async function runBenchmark(benchmark: BenchmarkModule) {
   benchmark.register();
   await run({ throw: true });
}