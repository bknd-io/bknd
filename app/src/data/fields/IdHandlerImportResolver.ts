import type { IdHandler } from './IdHandlerRegistry';

/**
 * Result of import resolution
 */
export interface ImportResolutionResult {
  success: boolean;
  handler?: IdHandler;
  error?: string;
  warnings?: string[];
}

/**
 * Configuration for import-based ID handlers
 */
export interface ImportHandlerConfig {
  importPath: string;
  functionName?: string;
  options?: Record<string, any>;
}

/**
 * Resolves and loads external ID handler modules
 */
export class IdHandlerImportResolver {
  private static instance: IdHandlerImportResolver | null = null;
  private importCache = new Map<string, any>();
  private handlerCache = new Map<string, IdHandler>();

  /**
   * Get the singleton instance
   */
  static getInstance(): IdHandlerImportResolver {
    if (!IdHandlerImportResolver.instance) {
      IdHandlerImportResolver.instance = new IdHandlerImportResolver();
    }
    return IdHandlerImportResolver.instance;
  }

  /**
   * Resolve and load an external ID handler
   */
  async resolveHandler(config: ImportHandlerConfig): Promise<ImportResolutionResult> {
    const cacheKey = `${config.importPath}:${config.functionName || 'default'}`;
    
    // Check cache first
    if (this.handlerCache.has(cacheKey)) {
      return {
        success: true,
        handler: this.handlerCache.get(cacheKey)!
      };
    }

    try {
      // Validate configuration
      const validationResult = this.validateImportConfig(config);
      if (!validationResult.success) {
        return validationResult;
      }

      // Load the module
      const moduleResult = await this.loadModule(config.importPath);
      if (!moduleResult.success) {
        return moduleResult;
      }

      // Extract the handler function
      const handlerResult = this.extractHandler(moduleResult.module!, config.functionName);
      if (!handlerResult.success) {
        return handlerResult;
      }

      // Create the IdHandler object
      const handler: IdHandler = {
        id: `import:${cacheKey}`,
        name: `Imported Handler (${config.importPath})`,
        description: `Handler imported from ${config.importPath}${config.functionName ? `:${config.functionName}` : ''}`,
        handler: handlerResult.handler!
      };

      // Validate the handler function
      const functionValidation = await this.validateHandlerFunction(handler.handler);
      if (!functionValidation.success) {
        return {
          success: false,
          error: functionValidation.error,
          warnings: functionValidation.warnings
        };
      }

      // Cache and return the handler
      this.handlerCache.set(cacheKey, handler);
      return {
        success: true,
        handler,
        warnings: functionValidation.warnings
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to resolve handler: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Validate import configuration
   */
  private validateImportConfig(config: ImportHandlerConfig): ImportResolutionResult {
    const errors: string[] = [];

    if (!config.importPath || typeof config.importPath !== 'string') {
      errors.push('Import path is required and must be a string');
    }

    if (config.functionName !== undefined && typeof config.functionName !== 'string') {
      errors.push('Function name must be a string if provided');
    }

    if (config.options !== undefined && (typeof config.options !== 'object' || config.options === null)) {
      errors.push('Options must be an object if provided');
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: errors.join('; ')
      };
    }

    return { success: true };
  }

  /**
   * Load a module using dynamic import
   */
  private async loadModule(importPath: string): Promise<{ success: boolean; module?: any; error?: string }> {
    // Check cache first
    if (this.importCache.has(importPath)) {
      return {
        success: true,
        module: this.importCache.get(importPath)
      };
    }

    try {
      // Normalize the import path
      const normalizedPath = this.normalizeImportPath(importPath);
      
      // Attempt dynamic import
      const module = await import(normalizedPath);
      
      // Cache the module
      this.importCache.set(importPath, module);
      
      return {
        success: true,
        module
      };
    } catch (error) {
      // Try different import strategies for better compatibility
      const alternativeResults = await this.tryAlternativeImports(importPath);
      if (alternativeResults.success) {
        return alternativeResults;
      }

      return {
        success: false,
        error: `Failed to import module '${importPath}': ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Try alternative import strategies for better compatibility
   */
  private async tryAlternativeImports(importPath: string): Promise<{ success: boolean; module?: any; error?: string }> {
    const strategies = [
      // Try with file extension
      () => import(`${importPath}.js`),
      () => import(`${importPath}.mjs`),
      () => import(`${importPath}.ts`),
      // Try as relative path
      () => import(`./${importPath}`),
      () => import(`../${importPath}`),
      // Try with different path formats
      () => import(importPath.replace(/\\/g, '/')),
    ];

    for (const strategy of strategies) {
      try {
        const module = await strategy();
        this.importCache.set(importPath, module);
        return {
          success: true,
          module
        };
      } catch {
        // Continue to next strategy
      }
    }

    return {
      success: false,
      error: `All import strategies failed for '${importPath}'`
    };
  }

  /**
   * Normalize import path for better compatibility
   */
  private normalizeImportPath(importPath: string): string {
    // Handle Windows paths
    let normalized = importPath.replace(/\\/g, '/');
    
    // Handle relative paths
    if (!normalized.startsWith('./') && !normalized.startsWith('../') && !normalized.startsWith('/')) {
      // Check if it looks like a node module or absolute path
      if (!normalized.includes('/') || normalized.startsWith('@')) {
        // Likely a node module, keep as is
        return normalized;
      } else {
        // Likely a relative file, add ./
        normalized = `./${normalized}`;
      }
    }
    
    return normalized;
  }

  /**
   * Extract handler function from loaded module
   */
  private extractHandler(module: any, functionName?: string): { success: boolean; handler?: Function; error?: string } {
    try {
      let handler: Function;

      if (functionName) {
        // Extract named export
        if (!(functionName in module)) {
          return {
            success: false,
            error: `Function '${functionName}' not found in module. Available exports: ${Object.keys(module).join(', ')}`
          };
        }
        handler = module[functionName];
      } else {
        // Try default export first, then look for common handler names
        if (module.default && typeof module.default === 'function') {
          handler = module.default;
        } else if (module.handler && typeof module.handler === 'function') {
          handler = module.handler;
        } else if (module.idHandler && typeof module.idHandler === 'function') {
          handler = module.idHandler;
        } else {
          // Look for any function export
          const functionExports = Object.keys(module).filter(key => typeof module[key] === 'function');
          if (functionExports.length === 1) {
            handler = module[functionExports[0]];
          } else if (functionExports.length > 1) {
            return {
              success: false,
              error: `Multiple functions found, please specify functionName. Available: ${functionExports.join(', ')}`
            };
          } else {
            return {
              success: false,
              error: 'No function exports found in module'
            };
          }
        }
      }

      if (typeof handler !== 'function') {
        return {
          success: false,
          error: `Expected function, got ${typeof handler}`
        };
      }

      return {
        success: true,
        handler
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to extract handler: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Validate that a handler function works correctly
   */
  private async validateHandlerFunction(handler: Function): Promise<{ success: boolean; error?: string; warnings?: string[] }> {
    const warnings: string[] = [];

    try {
      // Test with sample data
      const testEntity = 'test_entity';
      const testData = { test: true };

      // Check function signature
      if (handler.length > 2) {
        warnings.push(`Handler function has ${handler.length} parameters, expected 0-2 (entity, data)`);
      }

      // Test execution with minimal data
      const result = await Promise.resolve(handler(testEntity, testData));

      // Validate return type
      if (typeof result !== 'string' && typeof result !== 'number') {
        return {
          success: false,
          error: `Handler returned invalid type: expected string or number, got ${typeof result}`
        };
      }

      // Check for empty results
      if (result === '' || (typeof result === 'number' && isNaN(result))) {
        warnings.push('Handler returned empty or invalid value during test');
      }

      return {
        success: true,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: `Handler validation failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Clear import and handler caches (mainly for testing)
   */
  clearCache(): void {
    this.importCache.clear();
    this.handlerCache.clear();
  }

  /**
   * Get cached modules (for debugging)
   */
  getCachedModules(): string[] {
    return Array.from(this.importCache.keys());
  }

  /**
   * Get cached handlers (for debugging)
   */
  getCachedHandlers(): string[] {
    return Array.from(this.handlerCache.keys());
  }
}

/**
 * Global import resolver instance
 */
export const idHandlerImportResolver = IdHandlerImportResolver.getInstance();