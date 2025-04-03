const adapter = process.env.TEST_ADAPTER;

const default_config = {
   media_adapter: "local"
} as const;

const configs = {
   cloudflare: {
      media_adapter: "r2"
   }
}

export function getAdapterConfig(): typeof default_config {
   if (adapter) {
      if (!configs[adapter]) {
         throw new Error(`Adapter "${adapter}" not found. Available adapters: ${Object.keys(configs).join(", ")}`);
      }

      return configs[adapter] as typeof default_config;
   }

   return default_config;
}