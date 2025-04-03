import { useEffect } from "react";
import { Scrollable } from "ui/layouts/AppShell/AppShell";
import { useApi } from "ui/client";

const swagger_url = "https://unpkg.com/swagger-ui-dist@5.20.2";

export default function SwaggerOpenAPI() {
   const api = useApi();

   useEffect(() => {
      // Create a script element to load the Swagger UI bundle
      const script = document.createElement("script");
      script.src = `${swagger_url}/swagger-ui-bundle.js`;
      script.crossOrigin = "anonymous";
      script.async = true;

      // Append the script to the body and set up Swagger UI once loaded
      script.onload = () => {
         // @ts-ignore
         if (window.SwaggerUIBundle) {
            // @ts-ignore
            window.ui = window.SwaggerUIBundle({
               url: api.baseUrl + "/api/system/openapi.json",
               dom_id: "#swagger-ui",
               persistAuthorization: true,
               presets: [
                  // @ts-ignore
                  window.SwaggerUIBundle.presets.apis,
                  // @ts-ignore
                  window.SwaggerUIStandalonePreset,
               ],
               presets_config: {
                  SwaggerUIStandalonePreset: {
                     TopbarPlugin: false,
                  },
               },
            });
         }
      };

      document.body.appendChild(script);

      // Cleanup script on unmount
      return () => {
         document.body.removeChild(script);
      };
   }, []);

   return (
      <>
         <link rel="stylesheet" href={`${swagger_url}/swagger-ui.css`} />
         <Styles />
         <Scrollable>
            <div id="swagger-ui" className="w-full pb-20" />
         </Scrollable>
      </>
   );
}

const Styles = () => (
   <style>{`
     #bknd-admin.dark .swagger-ui {
         filter: invert(88%) hue-rotate(180deg);
     }
     #bknd-admin.dark .swagger-ui .microlight {
         filter: invert(100%) hue-rotate(180deg);
     }
     .swagger-ui .info {
         margin: 10px 0;
     }
   }
`}</style>
);
