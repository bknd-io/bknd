import { type ClassNameValue, twMerge } from "tailwind-merge";

export function cn(...inputs: ClassNameValue[]) {
   return twMerge(inputs);
}

/**
 * Dynamically import a module from a URL in the browser in a way compatible with all react frameworks (nextjs doesn't support dynamic imports)
 */
export async function importDynamicBrowserModule<T = any>(name: string, url: string): Promise<T> {
   if (!(window as any)[name]) {
      const script = document.createElement("script");
      script.type = "module";
      script.async = true;
      script.textContent = `import * as ${name} from '${url}';window.${name} = ${name};`;
      document.head.appendChild(script);

      // poll for the module to be available
      const maxAttempts = 50; // 5s
      let attempts = 0;
      while (!(window as any)[name] && attempts < maxAttempts) {
         await new Promise((resolve) => setTimeout(resolve, 100));
         attempts++;
      }

      if (!(window as any)[name]) {
         throw new Error(`Browser module "${name}" failed to load`);
      }
   }

   return (window as any)[name] as T;
}
