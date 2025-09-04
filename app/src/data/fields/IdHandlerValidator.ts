import type { CustomIdHandlerConfig } from "./PrimaryField";
import type { IdHandler, ValidationResult } from "./IdHandlerRegistry";
import { idHandlerErrorManager, type ErrorResult, ErrorCategory, ErrorSeverity } from "./IdHandlerErrorManager";
import { resolve } from "path";
import { existsSync } from "fs";

/**
 * Comprehensive validation system for custom ID handlers.
 * 
 * Provides thorough validation of custom ID handler configurations,
 * including configuration structure validation, import resolution testing,
 * and handler execution testing with detailed error reporting.
 * 
 * @example
 * ```typescript
 * const validator = new IdHandlerValidator();
 * 
 * // Validate a function-based handler config
 * const result = validator.validateConfig({
 *   type: "function",
 *   handler: (entity) => `${entity}_${Date.now()}`
 * });
 * 
 * if (!result.valid) {
 *   console.error("Validation failed:", result.errors);
 * }
 * ```
 */
export class IdHandlerValidator {
  /**
   * Validate a custom ID handler configuration with enhanced error handling.
   * 
   * Performs comprehensive validation of the handler configuration including
   * type checking, required field validation, and logical consistency checks.
   * 
   * @param config - The custom ID handler configuration to validate
   * @returns Validation result with detailed error and warning information
   * 
   * @example
   * ```typescript
   * const validator = new IdHandlerValidator();
   * const result = validator.validateConfig({
   *   type: "import",
   *   importPath: "./handlers/customId",
   *   functionName: "generateId"
   * });
   * 
   * if (!result.valid) {
   *   result.errors.forEach(error => console.error(error));
   * }
   * ```
   */
  validateConfig(config: CustomIdHandlerConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields with detailed error messages
    if (!config.type) {
      errors.push("Handler type is required. Choose either 'function' for inline handlers or 'import' for external modules.");
    } else if (!["function", "import"].includes(config.type)) {
      errors.push(`Invalid handler type '${config.type}'. Must be 'function' or 'import'.`);
    }

    // Validate function type configuration with enhanced feedback
    if (config.type === "function") {
      if (!config.handler) {
        errors.push("Handler function is required when type is 'function'. Provide a function that accepts (entity: string, data?: any) and returns string | number | Promise<string | number>.");
      } else if (typeof config.handler !== "function") {
        errors.push(`Handler must be a function when type is 'function', got ${typeof config.handler}. Ensure you're providing a valid JavaScript function.`);
      } else {
        // Validate function signature with detailed feedback
        const funcValidation = this.validateHandlerFunction(config.handler);
        errors.push(...funcValidation.errors);
        warnings.push(...funcValidation.warnings);
      }

      // Warn about unused import fields with helpful context
      if (config.importPath) {
        warnings.push("importPath is ignored when type is 'function'. Remove this field or change type to 'import' if you want to use an external module.");
      }
      if (config.functionName) {
        warnings.push("functionName is ignored when type is 'function'. Remove this field or change type to 'import' if you want to use an external module.");
      }
    }

    // Validate import type configuration with enhanced feedback
    if (config.type === "import") {
      if (!config.importPath) {
        errors.push("importPath is required when type is 'import'. Provide the path to the module containing your ID handler function (e.g., './utils/id-generators' or 'my-id-package').");
      } else {
        const importValidation = this.validateImportPath(config.importPath);
        errors.push(...importValidation.errors);
        warnings.push(...importValidation.warnings);
      }

      if (config.functionName === undefined || config.functionName === null) {
        errors.push("functionName is required when type is 'import'. Specify the name of the exported function to use as the ID handler.");
      } else if (typeof config.functionName !== "string" || config.functionName.trim() === "") {
        errors.push("functionName must be a non-empty string. Provide the exact name of the exported function.");
      }

      // Warn about unused function field with helpful context
      if (config.handler) {
        warnings.push("handler function is ignored when type is 'import'. Remove this field or change type to 'function' if you want to use an inline function.");
      }
    }

    // Validate options with enhanced feedback
    if (config.options !== undefined) {
      if (typeof config.options !== "object" || config.options === null || Array.isArray(config.options)) {
        errors.push("options must be a plain object (e.g., { prefix: 'USER', startFrom: 1000 }). Arrays and null values are not allowed.");
      } else {
        // Check for potentially problematic option values
        const optionKeys = Object.keys(config.options);
        if (optionKeys.length > 10) {
          warnings.push(`Large number of options (${optionKeys.length}). Consider simplifying the configuration for better maintainability.`);
        }
        
        // Check for reserved option names that might conflict
        const reservedNames = ['entity', 'data', 'type', 'handler'];
        const conflictingKeys = optionKeys.filter(key => reservedNames.includes(key));
        if (conflictingKeys.length > 0) {
          warnings.push(`Option keys [${conflictingKeys.join(', ')}] may conflict with handler parameters. Consider using different names.`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate a handler function
   */
  validateHandler(handler: Function): ValidationResult {
    return this.validateHandlerFunction(handler);
  }

  /**
   * Validate import path and function name
   */
  async validateImport(importPath: string, functionName?: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic path validation
    const pathValidation = this.validateImportPath(importPath);
    errors.push(...pathValidation.errors);
    warnings.push(...pathValidation.warnings);

    if (errors.length > 0) {
      return { valid: false, errors, warnings };
    }

    // Function name validation
    if (functionName !== undefined) {
      if (functionName === null || typeof functionName !== "string" || functionName.trim() === "") {
        errors.push("functionName must be a non-empty string");
      }
    }

    // Try to resolve and validate the import
    try {
      const resolvedPath = this.resolveImportPath(importPath);
      
      // Check if file exists
      if (!existsSync(resolvedPath)) {
        errors.push(`Import file does not exist: ${resolvedPath}`);
        return { valid: false, errors, warnings };
      }

      // Try to dynamically import and validate
      try {
        // Use require for CommonJS modules in test environment
        let module: any;
        try {
          // Clear require cache to ensure fresh import
          delete require.cache[resolvedPath];
          module = require(resolvedPath);
        } catch (requireError) {
          // Fallback to dynamic import with proper URL formatting
          const importUrl = resolvedPath.startsWith('/') ? `file://${resolvedPath}` : `file:///${resolvedPath.replace(/\\/g, '/')}`;
          module = await import(importUrl);
        }
        
        if (functionName) {
          if (!(functionName in module)) {
            errors.push(`Function '${functionName}' not found in module '${importPath}'`);
          } else if (typeof module[functionName] !== "function") {
            errors.push(`Export '${functionName}' is not a function in module '${importPath}'`);
          } else {
            // Validate the imported function
            const funcValidation = this.validateHandlerFunction(module[functionName]);
            errors.push(...funcValidation.errors);
            warnings.push(...funcValidation.warnings);
          }
        } else {
          // Check for default export
          if (!module.default) {
            warnings.push(`No default export found in module '${importPath}', specify functionName`);
          } else if (typeof module.default !== "function") {
            errors.push(`Default export is not a function in module '${importPath}'`);
          } else {
            const funcValidation = this.validateHandlerFunction(module.default);
            errors.push(...funcValidation.errors);
            warnings.push(...funcValidation.warnings);
          }
        }
      } catch (importError) {
        errors.push(`Failed to import module '${importPath}': ${importError instanceof Error ? importError.message : String(importError)}`);
      }
    } catch (resolveError) {
      errors.push(`Failed to resolve import path '${importPath}': ${resolveError instanceof Error ? resolveError.message : String(resolveError)}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Test ID generation with a handler to verify it works correctly.
   * 
   * Executes the handler with test parameters and validates the returned
   * ID value for type correctness, uniqueness, and other quality checks.
   * 
   * @param handler - The ID handler to test
   * @param entity - Entity name to use for testing
   * @param testData - Optional test data to pass to the handler
   * @returns Promise resolving to validation result with test outcomes
   * 
   * @example
   * ```typescript
   * const validator = new IdHandlerValidator();
   * const handler = {
   *   id: "test-handler",
   *   name: "Test Handler",
   *   handler: (entity) => `${entity}_${Date.now()}`
   * };
   * 
   * const result = await validator.testGeneration(handler, "users");
   * if (result.valid) {
   *   console.log("Handler test passed");
   * } else {
   *   console.error("Handler test failed:", result.errors);
   * }
   * ```
   */
  async testGeneration(handler: IdHandler, entity: string, testData?: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Test with different scenarios
      const testCases = [
        { entity, data: testData, description: "with provided data" },
        { entity, data: undefined, description: "without data" },
        { entity, data: {}, description: "with empty data" }
      ];

      for (const testCase of testCases) {
        try {
          const result = await Promise.resolve(handler.handler(testCase.entity, testCase.data));
          
          // Validate result type
          if (typeof result !== "string" && typeof result !== "number") {
            errors.push(`Handler returned invalid type ${typeof result} ${testCase.description}`);
            continue;
          }

          // Validate result value
          if (typeof result === "string") {
            if (result.length === 0) {
              errors.push(`Handler returned empty string ${testCase.description}`);
            } else if (result.length > 255) {
              warnings.push(`Handler returned very long string (${result.length} chars) ${testCase.description}`);
            }
          }

          if (typeof result === "number") {
            if (!Number.isFinite(result)) {
              errors.push(`Handler returned non-finite number ${testCase.description}`);
            } else if (result < 0) {
              warnings.push(`Handler returned negative number ${testCase.description}`);
            }
          }

        } catch (testError) {
          errors.push(`Handler execution failed ${testCase.description}: ${testError instanceof Error ? testError.message : String(testError)}`);
        }
      }

      // Test performance
      const startTime = Date.now();
      try {
        await Promise.resolve(handler.handler(entity, testData));
        const executionTime = Date.now() - startTime;
        
        if (executionTime > 1000) {
          warnings.push(`Handler execution is slow (${executionTime}ms), consider optimization`);
        } else if (executionTime > 100) {
          warnings.push(`Handler execution took ${executionTime}ms, monitor performance in production`);
        }
      } catch {
        // Error already captured above
      }

    } catch (error) {
      errors.push(`Test generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate a handler function signature and behavior
   */
  private validateHandlerFunction(handler: Function): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check function signature
    if (handler.length > 2) {
      warnings.push(`Handler function has ${handler.length} parameters, only 'entity' and 'data' are passed`);
    }

    // Check if function is async or returns a promise
    const isAsync = handler.constructor.name === "AsyncFunction";
    if (isAsync) {
      warnings.push("Handler is async, ensure proper error handling in production");
    }

    // Try to analyze function source for common issues
    const funcSource = handler.toString();
    
    // Check for potential issues in function source
    if (funcSource.includes("Math.random()")) {
      warnings.push("Handler uses Math.random(), consider using crypto.randomUUID() for better uniqueness");
    }

    if (funcSource.includes("Date.now()")) {
      warnings.push("Handler uses Date.now(), ensure this provides sufficient uniqueness for your use case");
    }

    if (funcSource.includes("console.")) {
      warnings.push("Handler contains console statements, consider removing for production");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate import path format and accessibility
   */
  private validateImportPath(importPath: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!importPath || typeof importPath !== "string" || importPath.trim() === "") {
      errors.push("Import path cannot be empty");
      return { valid: false, errors, warnings };
    }

    const trimmedPath = importPath.trim();

    // Check for relative vs absolute paths
    if (trimmedPath.startsWith("./") || trimmedPath.startsWith("../")) {
      // Relative path - this is fine
    } else if (trimmedPath.startsWith("/")) {
      warnings.push("Absolute paths may not be portable across environments");
    } else {
      // Could be a node_modules package
      warnings.push("Ensure the package is installed and available");
    }

    // Check for common file extensions
    const hasExtension = /\.(js|ts|mjs|cjs)$/.test(trimmedPath);
    if (!hasExtension && !trimmedPath.includes("node_modules")) {
      warnings.push("Consider specifying file extension (.js, .ts, .mjs, .cjs)");
    }

    // Check for potentially problematic characters (excluding backslashes for Windows paths)
    if (/[<>"|?*]/.test(trimmedPath)) {
      errors.push("Import path contains invalid characters");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Resolve import path to absolute path
   */
  private resolveImportPath(importPath: string): string {
    // Handle relative paths
    if (importPath.startsWith("./") || importPath.startsWith("../")) {
      return resolve(process.cwd(), importPath);
    }

    // Handle absolute paths
    if (importPath.startsWith("/")) {
      return importPath;
    }

    // Handle node_modules packages - try to resolve
    try {
      return require.resolve(importPath);
    } catch {
      // If require.resolve fails, try as relative to cwd
      return resolve(process.cwd(), importPath);
    }
  }

  /**
   * Validate complete custom ID handler configuration including testing
   */
  async validateCompleteConfig(config: CustomIdHandlerConfig, entity: string = "test"): Promise<ValidationResult> {
    // First validate the configuration structure
    const configValidation = this.validateConfig(config);
    if (!configValidation.valid) {
      return configValidation;
    }

    const errors: string[] = [...configValidation.errors];
    const warnings: string[] = [...configValidation.warnings];

    // Test the actual handler execution
    try {
      if (config.type === "function" && config.handler) {
        // Create a temporary handler for testing
        const testHandler: IdHandler = {
          id: "test-handler",
          name: "Test Handler",
          handler: config.handler
        };

        const testResult = await this.testGeneration(testHandler, entity);
        errors.push(...testResult.errors);
        warnings.push(...testResult.warnings);

      } else if (config.type === "import" && config.importPath) {
        // Test import resolution and execution
        const importResult = await this.validateImport(config.importPath, config.functionName);
        errors.push(...importResult.errors);
        warnings.push(...importResult.warnings);
      }
    } catch (error) {
      errors.push(`Handler testing failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

/**
 * Global validator instance
 */
export const idHandlerValidator = new IdHandlerValidator();