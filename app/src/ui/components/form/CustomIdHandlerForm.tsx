import { useState, useEffect } from "react";
import { TbAlertCircle, TbCheck, TbInfoCircle, TbBulb, TbExclamationMark } from "react-icons/tb";
import type { CustomIdHandlerConfig } from "data/fields/PrimaryField";
import { idHandlerValidator } from "data/fields/IdHandlerValidator";
import { idHandlerErrorManager, type ErrorResult } from "data/fields/IdHandlerErrorManager";
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
   const [validationResult, setValidationResult] = useState<ErrorResult | null>(null);
   const [isValidating, setIsValidating] = useState(false);

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

   // Validate configuration and update parent with enhanced error handling
   useEffect(() => {
      const validateConfiguration = async () => {
         setIsValidating(true);
         
         let config: CustomIdHandlerConfig;

         if (handlerType === "function") {
            // Validate function code with enhanced error handling
            const validation = validateFunctionCode(functionCode);
            
            config = {
               type: "function",
               handler: validation.isValid ? validation.compiledFunction as (entity: string, data?: any) => string | number | Promise<string | number> : undefined,
            };

            // Convert basic validation to structured error result
            const errorResult: ErrorResult = {
               success: validation.isValid,
               errors: validation.errors.map(error => 
                  idHandlerErrorManager.createError(
                     idHandlerErrorManager.constructor.name.includes('Configuration') ? 
                        idHandlerErrorManager.constructor.name as any : 'configuration' as any,
                     'error' as any,
                     error,
                     { suggestions: getErrorSuggestions(error, 'function') }
                  )
               ),
               warnings: validation.warnings.map(warning => 
                  idHandlerErrorManager.createError(
                     'configuration' as any,
                     'warning' as any,
                     warning,
                     { suggestions: getErrorSuggestions(warning, 'function') }
                  )
               ),
               infos: [],
               recoverySuggestions: validation.isValid ? [] : [
                  "Fix function syntax errors before proceeding",
                  "Ensure function returns string or number",
                  "Test function with sample data"
               ]
            };

            setValidationResult(errorResult);
         } else {
            // Validate import configuration with enhanced error handling
            config = {
               type: "import",
               importPath: importPath.trim(),
               functionName: functionName.trim(),
            };

            // Use comprehensive validator for import configuration
            try {
               const validationResult = idHandlerValidator.validateConfig(config);
               const errorResult = idHandlerErrorManager.processValidationResult(
                  validationResult,
                  { entityName, handlerType: 'import' }
               );
               
               setValidationResult(errorResult);
            } catch (error) {
               const errorResult = idHandlerErrorManager.handleConfigurationError(
                  config,
                  [error instanceof Error ? error.message : String(error)],
                  { entityName, handlerType: 'import' }
               );
               setValidationResult(errorResult);
            }
         }

         setIsValidating(false);

         // Only call onChange if configuration is valid
         if (validationResult?.success !== false) {
            onChange(config);
         }
      };

      validateConfiguration();
   }, [handlerType, functionCode, importPath, functionName, onChange, entityName]);

   const handleTypeChange = (type: string) => {
      setHandlerType(type as "function" | "import");
      // Reset validation when switching types
      setValidationResult(null);
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

   const isValid = validationResult?.success !== false;

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

         {/* Enhanced Validation Feedback */}
         {isValidating && (
            <Alert.Info className="flex items-center gap-2">
               <TbInfoCircle size={16} />
               <span>Validating configuration...</span>
            </Alert.Info>
         )}

         {validationResult && validationResult.errors.length > 0 && (
            <Alert.Exception className="space-y-3">
               <div className="flex items-center gap-2">
                  <TbExclamationMark size={16} />
                  <span className="font-medium">Configuration Errors</span>
               </div>
               <div className="space-y-2">
                  {validationResult.errors.map((error, index) => (
                     <div key={index} className="border-l-2 border-red-300 pl-3">
                        <div className="text-sm font-medium text-red-800">{error.message}</div>
                        {error.suggestions.length > 0 && (
                           <div className="mt-1">
                              <div className="text-xs text-red-600 mb-1">Suggestions:</div>
                              <ul className="list-disc list-inside text-xs text-red-700 space-y-0.5">
                                 {error.suggestions.map((suggestion, suggestionIndex) => (
                                    <li key={suggestionIndex}>{suggestion}</li>
                                 ))}
                              </ul>
                           </div>
                        )}
                     </div>
                  ))}
               </div>
               {validationResult.recoverySuggestions.length > 0 && (
                  <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
                     <div className="flex items-center gap-1 text-xs font-medium text-red-800 mb-1">
                        <TbBulb size={12} />
                        Recovery Steps:
                     </div>
                     <ul className="list-disc list-inside text-xs text-red-700 space-y-0.5">
                        {validationResult.recoverySuggestions.map((suggestion, index) => (
                           <li key={index}>{suggestion}</li>
                        ))}
                     </ul>
                  </div>
               )}
            </Alert.Exception>
         )}

         {validationResult && validationResult.warnings.length > 0 && (
            <Alert.Warning className="space-y-3">
               <div className="flex items-center gap-2">
                  <TbAlertCircle size={16} />
                  <span className="font-medium">Configuration Warnings</span>
               </div>
               <div className="space-y-2">
                  {validationResult.warnings.map((warning, index) => (
                     <div key={index} className="border-l-2 border-yellow-300 pl-3">
                        <div className="text-sm font-medium text-yellow-800">{warning.message}</div>
                        {warning.suggestions.length > 0 && (
                           <div className="mt-1">
                              <div className="text-xs text-yellow-600 mb-1">Suggestions:</div>
                              <ul className="list-disc list-inside text-xs text-yellow-700 space-y-0.5">
                                 {warning.suggestions.map((suggestion, suggestionIndex) => (
                                    <li key={suggestionIndex}>{suggestion}</li>
                                 ))}
                              </ul>
                           </div>
                        )}
                     </div>
                  ))}
               </div>
            </Alert.Warning>
         )}

         {validationResult && validationResult.infos.length > 0 && (
            <Alert.Info className="space-y-2">
               <div className="flex items-center gap-2">
                  <TbInfoCircle size={16} />
                  <span className="font-medium">Information</span>
               </div>
               <div className="space-y-1">
                  {validationResult.infos.map((info, index) => (
                     <div key={index} className="text-sm text-blue-700">{info.message}</div>
                  ))}
               </div>
            </Alert.Info>
         )}

         {isValid && !isValidating && (handlerType === "function" ? functionCode.trim() : importPath.trim() && functionName.trim()) && (
            <Alert.Success className="flex items-center gap-2">
               <TbCheck size={16} />
               <span>Configuration is valid and ready to use</span>
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

function getErrorSuggestions(error: string, type: 'function' | 'import'): string[] {
   const suggestions: string[] = [];
   
   if (type === 'function') {
      if (error.includes('compilation failed') || error.includes('syntax')) {
         suggestions.push("Check for syntax errors in your function code");
         suggestions.push("Ensure proper JavaScript/TypeScript syntax");
         suggestions.push("Verify parentheses and brackets are balanced");
      }
      
      if (error.includes('parameters')) {
         suggestions.push("Function should accept (entity: string, data?: any) parameters");
         suggestions.push("Remove extra parameters or make them optional");
      }
      
      if (error.includes('console.log')) {
         suggestions.push("Remove console.log statements for production use");
         suggestions.push("Use proper logging if needed");
      }
      
      if (error.includes('Math.random')) {
         suggestions.push("Consider using crypto.randomUUID() for better uniqueness");
         suggestions.push("Ensure your random generation provides sufficient uniqueness");
      }
   } else if (type === 'import') {
      if (error.includes('path') || error.includes('required')) {
         suggestions.push("Provide a valid import path (e.g., './utils/handlers' or 'my-package')");
         suggestions.push("Use relative paths for local files or package names for npm modules");
      }
      
      if (error.includes('function') || error.includes('name')) {
         suggestions.push("Specify the exact name of the exported function");
         suggestions.push("Check the module exports to verify the function name");
      }
   }
   
   if (suggestions.length === 0) {
      suggestions.push("Review the configuration and try again");
      suggestions.push("Check the documentation for examples");
   }
   
   return suggestions;
}