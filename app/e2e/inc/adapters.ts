const adapter = process.env.TEST_ADAPTER;

const default_config = {
   media_adapter: "local",
   base_path: "",
} as const;

const configs = {
   cloudflare: {
      media_adapter: "r2",
   },
   "react-router": {
      base_path: "/admin",
   },
   nextjs: {
      base_path: "/admin",
   },
   astro: {
      base_path: "/admin",
   },
   node: {
      base_path: "",
   },
   bun: {
      base_path: "",
   },
};

export function getAdapterConfig(): typeof default_config {
   if (adapter) {
      if (!configs[adapter]) {
         console.warn(
            `Adapter "${adapter}" not found. Available adapters: ${Object.keys(configs).join(", ")}`,
         );
      } else {
         return {
            ...default_config,
            ...configs[adapter],
         };
      }
   }

   return default_config;
}
