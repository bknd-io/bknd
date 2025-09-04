import { Registry } from "core/registry/Registry";
import { idHandlerErrorManager, type ErrorResult } from "./IdHandlerErrorManager";

/**
 * Interface for custom ID generation handlers
 */
export interface IdHandler {
  /** Unique identifier for the handler */
  id: string;
  /** Human-readable name for the handler */
  name: string;
  /** The actual ID generation function */
  handler: (entity: string, data?: any) => string | number | Promise<string | number>;
  /** Optional validation function for handler configuration */
  validate?: (config: any) => boolean | string;
  /** Optional description of what this handler does */
  description?: string;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Handler execution result with detailed error information
 */
export interface HandlerExecutionResult {
  success: boolean;
  value?: string | number;
  error?: ErrorResult;
  executionTime?: number;
  fallbackUsed?: boolean;
}

/**
 * Registry for managing custom ID generation handlers
 */
export class IdHandlerRegistry extends Registry<IdHandler> {
  private static instance: IdHandlerRegistry | null = null;

  constructor() {
    super();
  }

  /**
   * Get the singleton instance of the registry
   */
  static getInstance(): IdHandlerRegistry {
    if (!IdHandlerRegistry.instance) {
      IdHandlerRegistry.instance = new IdHandlerRegistry();
    }
    return IdHandlerRegistry.instance;
  }

  /**
   * Register a new ID handler
   */
  register(id: string, handler: IdHandler): this {
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
   * Retrieve a handler by ID
   */
  getHandler(id: string): IdHandler | undefined {
    return this.get(id);
  }

  /**
   * List all registered handlers
   */
  listHandlers(): Record<string, IdHandler> {
    return this.all();
  }

  /**
   * Validate a handler configuration
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
   * Execute a handler to generate an ID with comprehensive error handling
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
   * Execute a handler with automatic fallback to UUID generation
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
   * Validate a handler object
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
   * Unregister a handler by ID
   */
  unregister(id: string): boolean {
    if (this.has(id)) {
      delete (this as any).items[id];
      return true;
    }
    return false;
  }

  /**
   * Clear all handlers (mainly for testing)
   */
  clear(): void {
    (this as any).items = {};
  }
}

/**
 * Global registry instance
 */
export const idHandlerRegistry = IdHandlerRegistry.getInstance();