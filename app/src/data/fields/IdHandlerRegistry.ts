import { Registry } from "core/registry/Registry";
import { idHandlerErrorManager, type ErrorResult } from "./IdHandlerErrorManager";
import type { 
  IdHandler, 
  ValidationResult, 
  HandlerExecutionResult,
  IdHandlerRegistryInterface 
} from "./types";

// Re-export types for backward compatibility and convenience
export type { IdHandler, ValidationResult, HandlerExecutionResult } from "./types";

/**
 * Registry for managing custom ID generation handlers.
 * 
 * This class provides a centralized system for registering, validating, and executing
 * custom ID generation handlers. It extends the base Registry class and adds
 * specialized functionality for ID handler management.
 * 
 * @example
 * ```typescript
 * import { idHandlerRegistry } from './IdHandlerRegistry';
 * 
 * // Register a custom handler
 * idHandlerRegistry.register('sequential', {
 *   id: 'sequential',
 *   name: 'Sequential ID Generator',
 *   handler: (entity) => `${entity}_${getNextSequence(entity)}`,
 *   description: 'Generates sequential IDs with entity prefixes'
 * });
 * 
 * // Execute the handler
 * const result = await idHandlerRegistry.execute('sequential', 'users');
 * console.log(result.value); // "users_1"
 * ```
 * 
 * @extends Registry<IdHandler>
 * @implements IdHandlerRegistryInterface
 */
export class IdHandlerRegistry extends Registry<IdHandler> implements IdHandlerRegistryInterface {
  private static instance: IdHandlerRegistry | null = null;

  constructor() {
    super();
  }

  /**
   * Get the singleton instance of the registry.
   * 
   * Implements the singleton pattern to ensure there's only one registry
   * instance throughout the application lifecycle.
   * 
   * @returns The singleton IdHandlerRegistry instance
   * 
   * @example
   * ```typescript
   * const registry = IdHandlerRegistry.getInstance();
   * registry.register('my-handler', myHandlerConfig);
   * ```
   */
  static getInstance(): IdHandlerRegistry {
    if (!IdHandlerRegistry.instance) {
      IdHandlerRegistry.instance = new IdHandlerRegistry();
    }
    return IdHandlerRegistry.instance;
  }

  /**
   * Register a new ID handler in the registry.
   * 
   * Validates the handler configuration before registration and throws an error
   * if the handler is invalid or if a handler with the same ID already exists.
   * 
   * @param id - Unique identifier for the handler
   * @param handler - The handler configuration object
   * @returns The registry instance for method chaining
   * 
   * @throws {Error} If a handler with the same ID is already registered
   * @throws {Error} If the handler configuration is invalid
   * 
   * @example
   * ```typescript
   * registry.register('prefixed-id', {
   *   id: 'prefixed-id',
   *   name: 'Prefixed ID Generator',
   *   handler: (entity) => `${entity.slice(0, 3)}_${Date.now()}`,
   *   description: 'Generates IDs with 3-letter entity prefixes'
   * });
   * ```
   */
  override register(id: string, handler: IdHandler): this {
    if (this.has(id)) {
      throw new Error(`ID handler with id '${id}' is already registered`);
    }

    // Validate the handler before registration
    const validation = this.validateHandler(handler);
    if (!validation.valid) {
      throw new Error(`Invalid handler: ${validation.errors.join(', ')}`);
    }

    return super.add(id, handler);
  }

  /**
   * Retrieve a handler by its unique identifier.
   * 
   * @param id - The unique identifier of the handler to retrieve
   * @returns The handler configuration if found, undefined otherwise
   * 
   * @example
   * ```typescript
   * const handler = registry.getHandler('sequential');
   * if (handler) {
   *   console.log(`Found handler: ${handler.name}`);
   *   const id = await handler.handler('users');
   * } else {
   *   console.log('Handler not found');
   * }
   * ```
   */
  getHandler(id: string): IdHandler | undefined {
    return this.get(id);
  }

  /**
   * List all registered handlers in the registry.
   * 
   * @returns Object mapping handler IDs to their configurations
   * 
   * @example
   * ```typescript
   * const allHandlers = registry.listHandlers();
   * Object.entries(allHandlers).forEach(([id, handler]) => {
   *   console.log(`${id}: ${handler.name} - ${handler.description}`);
   * });
   * ```
   */
  listHandlers(): Record<string, IdHandler> {
    return this.all();
  }

  /**
   * Validate a configuration object against a registered handler.
   * 
   * Uses the handler's validate function (if provided) to check if the
   * given configuration is valid for the handler.
   * 
   * @param id - The handler ID to validate against
   * @param config - Configuration object to validate
   * @returns Validation result with success status and any errors/warnings
   * 
   * @example
   * ```typescript
   * const result = registry.validateConfig('sequential', { startFrom: 1000 });
   * if (!result.valid) {
   *   console.error('Validation errors:', result.errors);
   * } else if (result.warnings.length > 0) {
   *   console.warn('Validation warnings:', result.warnings);
   * }
   * ```
   */
  validateConfig(id: string, config: any): ValidationResult {
    const handler = this.getHandler(id);
    if (!handler) {
      return {
        valid: false,
        errors: [`Handler with id '${id}' not found`],
        warnings: []
      };
    }

    if (handler.validate) {
      const result = handler.validate(config);
      if (typeof result === 'boolean') {
        return {
          valid: result,
          errors: result ? [] : ['Handler validation failed'],
          warnings: []
        };
      } else {
        return {
          valid: false,
          errors: [result],
          warnings: []
        };
      }
    }

    return {
      valid: true,
      errors: [],
      warnings: []
    };
  }

  /**
   * Execute a handler to generate an ID with comprehensive error handling.
   * 
   * Executes the specified handler with the given parameters and returns
   * detailed information about the execution, including performance metrics
   * and error details if the execution fails.
   * 
   * @param id - The handler ID to execute
   * @param entity - The entity name for ID generation
   * @param data - Optional data to pass to the handler function
   * @returns Promise resolving to execution result with generated ID or error details
   * 
   * @example
   * ```typescript
   * const result = await registry.execute('sequential', 'users', { prefix: 'usr' });
   * if (result.success) {
   *   console.log(`Generated ID: ${result.value} (took ${result.executionTime}ms)`);
   * } else {
   *   console.error('Generation failed:', result.error?.errors);
   * }
   * ```
   */
  async execute(id: string, entity: string, data?: any): Promise<HandlerExecutionResult> {
    const startTime = Date.now();
    const handler = this.getHandler(id);
    
    if (!handler) {
      const error = idHandlerErrorManager.handleExecutionError(
        new Error(`Handler with id '${id}' not found`),
        id,
        entity,
        { availableHandlers: Object.keys(this.all()) }
      );
      
      return {
        success: false,
        error,
        executionTime: Date.now() - startTime
      };
    }

    try {
      const result = await Promise.resolve(handler.handler(entity, data));
      const executionTime = Date.now() - startTime;
      
      // Validate the result type
      if (typeof result !== 'string' && typeof result !== 'number') {
        const error = idHandlerErrorManager.handleExecutionError(
          new Error(`Handler returned invalid type: expected string or number, got ${typeof result}`),
          id,
          entity,
          { returnedValue: result, returnedType: typeof result }
        );
        
        return {
          success: false,
          error,
          executionTime
        };
      }

      // Check for performance issues
      if (executionTime > 100) {
        const performanceWarning = idHandlerErrorManager.handlePerformanceWarning(
          executionTime,
          id,
          { entity, dataProvided: !!data }
        );
        
        return {
          success: true,
          value: result,
          executionTime,
          error: performanceWarning.warnings.length > 0 ? performanceWarning : undefined
        };
      }

      return {
        success: true,
        value: result,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorResult = idHandlerErrorManager.handleExecutionError(
        error instanceof Error ? error : new Error(String(error)),
        id,
        entity,
        { executionTime, dataProvided: !!data }
      );
      
      return {
        success: false,
        error: errorResult,
        executionTime
      };
    }
  }

  /**
   * Execute a handler with automatic fallback to UUID generation.
   * 
   * If the primary handler fails, automatically falls back to UUID v7 generation
   * to ensure an ID is always produced. This is useful for production environments
   * where ID generation must never fail completely.
   * 
   * @param id - The handler ID to execute
   * @param entity - The entity name for ID generation
   * @param data - Optional data to pass to the handler function
   * @returns Promise resolving to execution result, with fallback used if needed
   * 
   * @example
   * ```typescript
   * const result = await registry.executeWithFallback('custom', 'users');
   * console.log(`Generated ID: ${result.value}`);
   * if (result.fallbackUsed) {
   *   console.warn('Custom handler failed, UUID fallback was used');
   *   console.error('Original error:', result.error);
   * }
   * ```
   */
  async executeWithFallback(id: string, entity: string, data?: any): Promise<HandlerExecutionResult> {
    const result = await this.execute(id, entity, data);
    
    if (!result.success) {
      // Log the error for debugging
      console.warn(`Custom ID handler '${id}' failed, falling back to UUID:`, 
        idHandlerErrorManager.generateErrorSummary(result.error!));
      
      try {
        // Import uuidv7 dynamically to avoid circular dependencies
        const { uuidv7 } = await import("bknd/utils");
        const fallbackValue = uuidv7();
        
        return {
          success: true,
          value: fallbackValue,
          executionTime: result.executionTime,
          fallbackUsed: true,
          error: result.error // Keep original error for reference
        };
      } catch (fallbackError) {
        // Even fallback failed - this is a critical error
        const criticalError = idHandlerErrorManager.handleExecutionError(
          new Error(`Both custom handler and UUID fallback failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`),
          id,
          entity,
          { originalError: result.error, fallbackError }
        );
        
        return {
          success: false,
          error: criticalError,
          executionTime: result.executionTime
        };
      }
    }
    
    return result;
  }

  /**
   * Validate a handler object for structural correctness.
   * 
   * Performs validation on the handler object itself, checking that all
   * required fields are present and have the correct types.
   * 
   * @param handler - The handler object to validate
   * @returns Validation result indicating if the handler structure is valid
   * 
   * @private
   */
  private validateHandler(handler: IdHandler): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!handler.id || typeof handler.id !== 'string') {
      errors.push('Handler must have a valid string id');
    }

    if (!handler.name || typeof handler.name !== 'string') {
      errors.push('Handler must have a valid string name');
    }

    if (!handler.handler || typeof handler.handler !== 'function') {
      errors.push('Handler must have a valid function');
    }

    // Optional fields validation
    if (handler.validate && typeof handler.validate !== 'function') {
      errors.push('Handler validate property must be a function');
    }

    if (handler.description && typeof handler.description !== 'string') {
      warnings.push('Handler description should be a string');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Unregister a handler by its unique identifier.
   * 
   * Removes the handler from the registry, making it unavailable for
   * future ID generation operations.
   * 
   * @param id - The handler ID to remove from the registry
   * @returns `true` if the handler was found and removed, `false` if not found
   * 
   * @example
   * ```typescript
   * const removed = registry.unregister('old-handler');
   * if (removed) {
   *   console.log('Handler removed successfully');
   * } else {
   *   console.log('Handler not found');
   * }
   * ```
   */
  unregister(id: string): boolean {
    if (this.has(id)) {
      delete (this as any).items[id];
      return true;
    }
    return false;
  }

  /**
   * Clear all registered handlers from the registry.
   * 
   * Removes all handlers from the registry. This is primarily used for
   * testing and cleanup operations. Use with caution in production environments.
   * 
   * @example
   * ```typescript
   * // Clear all handlers (typically in test cleanup)
   * registry.clear();
   * console.log(Object.keys(registry.listHandlers()).length); // 0
   * ```
   */
  clear(): void {
    (this as any).items = {};
  }
}

/**
 * Global singleton instance of the ID handler registry.
 * 
 * This is the main registry instance used throughout the application
 * for managing custom ID handlers. Import this instance to register
 * new handlers or execute existing ones.
 * 
 * @example
 * ```typescript
 * import { idHandlerRegistry } from './IdHandlerRegistry';
 * 
 * // Register a handler
 * idHandlerRegistry.register('my-handler', {
 *   id: 'my-handler',
 *   name: 'My Custom Handler',
 *   handler: (entity) => `${entity}_${Date.now()}`
 * });
 * 
 * // Use the handler
 * const result = await idHandlerRegistry.execute('my-handler', 'users');
 * ```
 */
export const idHandlerRegistry = IdHandlerRegistry.getInstance();