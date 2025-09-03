import { useState, useEffect, useMemo } from "react";
import { TbCode, TbFileImport, TbAlertCircle, TbCheck } from "react-icons/tb";
import type { CustomIdHandlerConfig } from "data/fields/PrimaryField";
import { SegmentedControl } from "./SegmentedControl";
import * as Formy from "./Formy";
import CodeEditor from "ui/components/code/CodeEditor";
import { Alert } from "ui/components/display/Alert";

export interface CustomIdHandlerFormProps {
   value?: CustomIdHandlerConfig;
   onChange: (config: CustomIdHandlerConfig) => void;
   entityName: string;
   disabled?: boolean;
}

export function CustomIdHandlerForm({ 
   value, 
   onChange, 
   entityName, 
   disabled = false 
}: CustomIdHandlerFormProps) {
   const [handlerType, setHandlerType] = useState<"function" | "import">(
      value?.type || "function"
   );
   const [functionCode, setFunctionCode] = useState<string>(
      value?.handler?.toString() || getDefaultFunctionCode(entityName)
   );
   const [importPath, setImportPath] = useState<string>(value?.importPath || "");
   const [functionName, setFunctionName] = useState<string>(value?.functionName || "");
   const [validationErrors, setValidationErrors] = useState<string[]>([]);
   const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

   // Update internal state when value prop changes
   useEffect(() => {
      if (value) {
         setHandlerType(value.type);
         if (value.type === "function" && value.handler) {
            setFunctionCode(value.handler.toString());
         }
         if (value.type === "import") {
            setImportPath(value.importPath || "");
            setFunctionName(value.functionName || "");
         }
      }
   }, [value]);

   // Validate configuration and update parent
   useEffect(() => {
      const errors: string[] = [];
      const warnings: string[] = [];
      let config: CustomIdHandlerConfig;

      if (handlerType === "function") {
         // Validate function code
         const validation = validateFunctionCode(functionCode);
         errors.push(...validation.errors);
         warnings.push(...validation.warnings);

         config = {
            type: "function",
            handler: validation.isValid ? validation.compiledFunction as (entity: string, data?: any) => string | number | Promise<string | number> : undefined,
         };
      } else {
         // Validate import configuration
         if (!importPath.trim()) {
            errors.push("Import path is required");
         }
         if (!functionName.trim()) {
            errors.push("Function name is required");
         }

         // Basic import path validation
         if (importPath.trim() && !isValidImportPath(importPath)) {
            errors.push("Invalid import path format");
         }

         config = {
            type: "import",
            importPath: importPath.trim(),
            functionName: functionName.trim(),
         };
      }

      setValidationErrors(errors);
      setValidationWarnings(warnings);

      // Only call onChange if configuration is valid
      if (errors.length === 0) {
         onChange(config);
      }
   }, [handlerType, functionCode, importPath, functionName, onChange]);

   const handleTypeChange = (type: string) => {
      setHandlerType(type as "function" | "import");
      // Reset validation when switching types
      setValidationErrors([]);
      setValidationWarnings([]);
   };

   const handleFunctionCodeChange = (code: string) => {
      setFunctionCode(code);
   };

   const handleImportPathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setImportPath(e.target.value);
   };

   const handleFunctionNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setFunctionName(e.target.value);
   };

   const isValid = validationErrors.length === 0;

   return (
      <div className="space-y-4">
         {/* Handler Type Selection */}
         <Formy.Group>
            <Formy.Label>Handler Type</Formy.Label>
            <SegmentedControl
               value={handlerType}
               onChange={handleTypeChange}
               data={[
                  { label: "Inline Function", value: "function" },
                  { label: "Import", value: "import" }
               ]}
               disabled={disabled}
            />
            <Formy.Help>
               Choose whether to define the ID handler inline or import from an external module
            </Formy.Help>
         </Formy.Group>

         {/* Function Editor */}
         {handlerType === "function" && (
            <Formy.Group>
               <Formy.Label>Handler Function</Formy.Label>
               <div className="border border-muted rounded-md overflow-hidden">
                  <CodeEditor
                     value={functionCode}
                     onChange={handleFunctionCodeChange}
                     editable={!disabled}
                     height="200px"
                     _extensions={{ javascript: true }}
                     placeholder="Enter your custom ID generation function..."
                  />
               </div>
               <Formy.Help>
                  Function should accept (entity: string, data?: any) and return string | number | Promise&lt;string | number&gt;
               </Formy.Help>
               {/* Function Examples */}
               <details className="text-sm">
                  <summary className="cursor-pointer text-primary/70 hover:text-primary">
                     Show examples
                  </summary>
                  <div className="mt-2 space-y-2 text-xs bg-muted/20 p-3 rounded">
                     <div>
                        <strong>Prefixed ID:</strong>
                        <code className="block mt-1 bg-muted/40 p-2 rounded">
                           {`(entity) => \`\${entity.toUpperCase()}_\${Date.now()}\``}
                        </code>
                     </div>
                     <div>
                        <strong>Sequential ID:</strong>
                        <code className="block mt-1 bg-muted/40 p-2 rounded">
                           {`(entity, data) => \`\${entity}_\${(data?.lastId || 0) + 1}\``}
                        </code>
                     </div>
                  </div>
               </details>
            </Formy.Group>
         )}

         {/* Import Configuration */}
         {handlerType === "import" && (
            <>
               <Formy.Group>
                  <Formy.Label>Import Path</Formy.Label>
                  <Formy.Input
                     value={importPath}
                     onChange={handleImportPathChange}
                     placeholder="./utils/id-generators"
                     disabled={disabled}
                  />
                  <Formy.Help>
                     Path to the module containing your ID handler function
                  </Formy.Help>
               </Formy.Group>

               <Formy.Group>
                  <Formy.Label>Function Name</Formy.Label>
                  <Formy.Input
                     value={functionName}
                     onChange={handleFunctionNameChange}
                     placeholder="generateCustomId"
                     disabled={disabled}
                  />
                  <Formy.Help>
                     Name of the exported function to use as the ID handler
                  </Formy.Help>
               </Formy.Group>

               <div className="text-sm bg-muted/20 p-3 rounded">
                  <strong>Example module structure:</strong>
                  <code className="block mt-1 bg-muted/40 p-2 rounded text-xs">
                     {`// ./utils/id-generators.ts
export function generateCustomId(entity: string, data?: any): string {
  return \`\${entity.toUpperCase()}_\${Date.now()}\`;
}`}
                  </code>
               </div>
            </>
         )}

         {/* Validation Feedback */}
         {validationErrors.length > 0 && (
            <Alert.Exception className="space-y-1">
               <div className="flex items-center gap-2">
                  <TbAlertCircle size={16} />
                  <span className="font-medium">Configuration Errors</span>
               </div>
               <ul className="list-disc list-inside space-y-1 text-sm">
                  {validationErrors.map((error, index) => (
                     <li key={index}>{error}</li>
                  ))}
               </ul>
            </Alert.Exception>
         )}

         {validationWarnings.length > 0 && (
            <Alert.Warning className="space-y-1">
               <div className="flex items-center gap-2">
                  <TbAlertCircle size={16} />
                  <span className="font-medium">Warnings</span>
               </div>
               <ul className="list-disc list-inside space-y-1 text-sm">
                  {validationWarnings.map((warning, index) => (
                     <li key={index}>{warning}</li>
                  ))}
               </ul>
            </Alert.Warning>
         )}

         {isValid && (handlerType === "function" ? functionCode.trim() : importPath.trim() && functionName.trim()) && (
            <Alert.Success className="flex items-center gap-2">
               <TbCheck size={16} />
               <span>Configuration is valid</span>
            </Alert.Success>
         )}
      </div>
   );
}

// Helper functions

function getDefaultFunctionCode(entityName: string): string {
   return `(entity, data) => {
  // Generate a custom ID for ${entityName}
  // Return a string or number
  return \`\${entity.toUpperCase()}_\${Date.now()}\`;
}`;
}

interface FunctionValidation {
   isValid: boolean;
   errors: string[];
   warnings: string[];
   compiledFunction?: Function;
}

function validateFunctionCode(code: string): FunctionValidation {
   const errors: string[] = [];
   const warnings: string[] = [];
   let compiledFunction: Function | undefined;

   if (!code.trim()) {
      errors.push("Function code is required");
      return { isValid: false, errors, warnings };
   }

   try {
      // Try to compile the function
      // We wrap it in parentheses to handle both arrow functions and function expressions
      const wrappedCode = code.trim().startsWith('(') ? code : `(${code})`;
      compiledFunction = eval(wrappedCode);

      if (typeof compiledFunction !== 'function') {
         errors.push("Code must evaluate to a function");
         return { isValid: false, errors, warnings };
      }

      // Check function signature
      const funcStr = compiledFunction.toString();
      const paramMatch = funcStr.match(/\(([^)]*)\)/);
      
      if (paramMatch && paramMatch[1]) {
         const params = paramMatch[1].split(',').map(p => p.trim()).filter(Boolean);
         if (params.length === 0) {
            warnings.push("Function should accept at least one parameter (entity name)");
         } else if (params.length > 2) {
            warnings.push("Function should accept at most two parameters (entity, data)");
         }
      }

      // Check for common issues
      if (funcStr.includes('console.log')) {
         warnings.push("Consider removing console.log statements from production code");
      }

      if (funcStr.includes('Math.random')) {
         warnings.push("Using Math.random() may generate duplicate IDs");
      }

   } catch (error) {
      errors.push(`Function compilation failed: ${error instanceof Error ? error.message : String(error)}`);
      return { isValid: false, errors, warnings };
   }

   return {
      isValid: errors.length === 0,
      errors,
      warnings,
      compiledFunction
   };
}

function isValidImportPath(path: string): boolean {
   // Basic validation for import paths
   // Allow relative paths (./...) and package names
   const relativePath = /^\.{1,2}\//.test(path);
   const packageName = /^[a-zA-Z@][a-zA-Z0-9\-_/@]*$/.test(path);
   
   return relativePath || packageName;
}