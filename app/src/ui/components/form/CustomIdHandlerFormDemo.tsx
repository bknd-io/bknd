import { useState } from "react";
import { CustomIdHandlerForm } from "./CustomIdHandlerForm";
import type { CustomIdHandlerConfig } from "data/fields/PrimaryField";

/**
 * Demo component to test CustomIdHandlerForm functionality
 * This can be used for manual testing and verification
 */
export function CustomIdHandlerFormDemo() {
   const [config, setConfig] = useState<CustomIdHandlerConfig | undefined>();
   const [disabled, setDisabled] = useState(false);

   const handleConfigChange = (newConfig: CustomIdHandlerConfig) => {
      setConfig(newConfig);
      console.log("Config changed:", newConfig);
   };

   return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
         <h1 className="text-2xl font-bold">Custom ID Handler Form Demo</h1>
         
         <div className="space-y-4">
            <div className="flex items-center gap-4">
               <label className="flex items-center gap-2">
                  <input
                     type="checkbox"
                     checked={disabled}
                     onChange={(e) => setDisabled(e.target.checked)}
                  />
                  Disabled
               </label>
            </div>

            <div className="border border-muted rounded-lg p-4">
               <h2 className="text-lg font-semibold mb-4">Custom ID Handler Configuration</h2>
               <CustomIdHandlerForm
                  value={config}
                  onChange={handleConfigChange}
                  entityName="user"
                  disabled={disabled}
               />
            </div>

            <div className="bg-muted/20 p-4 rounded-lg">
               <h3 className="font-semibold mb-2">Current Configuration:</h3>
               <pre className="text-sm overflow-auto">
                  {JSON.stringify(config, null, 2)}
               </pre>
            </div>
         </div>
      </div>
   );
}