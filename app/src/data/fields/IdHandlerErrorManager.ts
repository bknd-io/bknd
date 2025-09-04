import type { CustomIdHandlerConfig } from "./PrimaryField";
import type { ValidationResult } from "./IdHandlerRegistry";

/**
 * Error categories for better error handling and user feedback
 */
export enum ErrorCategory {
    CONFIGURATION = "configuration",
    VALIDATION = "validation",
    EXECUTION = "execution",
    IMPORT = "import",
    PERFORMANCE = "performance",
    COMPATIBILITY = "compatibility"
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
    ERROR = "error",
    WARNING = "warning",
    INFO = "info"
}

/**
 * Structured error information with recovery suggestions
 */
export interface IdHandlerError {
    id: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    message: string;
    details?: string;
    suggestions: string[];
    code?: string;
    context?: Record<string, any>;
}

/**
 * Error result with categorized errors and recovery suggestions
 */
export interface ErrorResult {
    success: boolean;
    errors: IdHandlerError[];
    warnings: IdHandlerError[];
    infos: IdHandlerError[];
    recoverySuggestions: string[];
}

/**
 * Comprehensive error manager for custom ID handlers.
 * 
 * Provides centralized error handling, categorization, and user-friendly
 * error message generation for the custom ID generation system. Implements
 * the singleton pattern to ensure consistent error handling across the application.
 * 
 * @example
 * ```typescript
 * import { idHandlerErrorManager } from './IdHandlerErrorManager';
 * 
 * // Handle a configuration error
 * const errorResult = idHandlerErrorManager.handleConfigurationError(
 *   config,
 *   ["Handler function is required"],
 *   { entity: "users" }
 * );
 * 
 * // Display user-friendly error
 * errorResult.errors.forEach(error => {
 *   const formatted = idHandlerErrorManager.formatErrorForUI(error);
 *   console.error(`${formatted.title}: ${formatted.message}`);
 * });
 * ```
 */
export class IdHandlerErrorManager {
    private static instance: IdHandlerErrorManager | null = null;

    /**
     * Get the singleton instance of the error manager.
     * 
     * @returns The singleton IdHandlerErrorManager instance
     */
    static getInstance(): IdHandlerErrorManager {
        if (!IdHandlerErrorManager.instance) {
            IdHandlerErrorManager.instance = new IdHandlerErrorManager();
        }
        return IdHandlerErrorManager.instance;
    }

    /**
     * Create a structured error with recovery suggestions
     */
    createError(
        category: ErrorCategory,
        severity: ErrorSeverity,
        message: string,
        options: {
            details?: string;
            suggestions?: string[];
            code?: string;
            context?: Record<string, any>;
        } = {}
    ): IdHandlerError {
        return {
            id: this.generateErrorId(category, severity),
            category,
            severity,
            message,
            details: options.details,
            suggestions: options.suggestions || this.getDefaultSuggestions(category, severity),
            code: options.code,
            context: options.context
        };
    }

    /**
     * Convert validation result to structured error result
     */
    processValidationResult(result: ValidationResult, context?: Record<string, any>): ErrorResult {
        const errors: IdHandlerError[] = [];
        const warnings: IdHandlerError[] = [];
        const infos: IdHandlerError[] = [];

        // Process errors
        result.errors.forEach(error => {
            const structuredError = this.categorizeError(error, ErrorSeverity.ERROR, context);
            errors.push(structuredError);
        });

        // Process warnings
        result.warnings.forEach(warning => {
            const structuredWarning = this.categorizeError(warning, ErrorSeverity.WARNING, context);
            warnings.push(structuredWarning);
        });

        const recoverySuggestions = this.generateRecoverySuggestions(errors, warnings);

        return {
            success: result.valid,
            errors,
            warnings,
            infos,
            recoverySuggestions
        };
    }

    /**
     * Handle handler execution errors with fallback strategies
     */
    handleExecutionError(
        error: Error,
        handlerId: string,
        entity: string,
        context?: Record<string, any>
    ): ErrorResult {
        const structuredError = this.createError(
            ErrorCategory.EXECUTION,
            ErrorSeverity.ERROR,
            `Handler '${handlerId}' execution failed: ${error.message}`,
            {
                details: error.stack,
                suggestions: [
                    "Check handler function logic for runtime errors",
                    "Ensure handler returns string or number",
                    "Verify handler can handle the provided data",
                    "Consider adding error handling within the handler function",
                    "Test handler with sample data before deployment"
                ],
                code: "HANDLER_EXECUTION_FAILED",
                context: { handlerId, entity, ...context }
            }
        );

        return {
            success: false,
            errors: [structuredError],
            warnings: [],
            infos: [],
            recoverySuggestions: [
                "The system will automatically fall back to UUID generation",
                "Review handler implementation and test with sample data",
                "Consider simplifying handler logic to avoid runtime errors"
            ]
        };
    }

    /**
     * Handle import resolution errors with detailed suggestions
     */
    handleImportError(
        error: Error,
        importPath: string,
        functionName?: string,
        context?: Record<string, any>
    ): ErrorResult {
        const suggestions = this.getImportErrorSuggestions(error.message, importPath, functionName);

        const structuredError = this.createError(
            ErrorCategory.IMPORT,
            ErrorSeverity.ERROR,
            `Failed to import handler from '${importPath}': ${error.message}`,
            {
                details: error.stack,
                suggestions,
                code: "IMPORT_RESOLUTION_FAILED",
                context: { importPath, functionName, ...context }
            }
        );

        return {
            success: false,
            errors: [structuredError],
            warnings: [],
            infos: [],
            recoverySuggestions: [
                "Verify the import path is correct and the file exists",
                "Check that the function is properly exported",
                "Ensure the module is accessible from the application context"
            ]
        };
    }

    /**
     * Handle configuration validation errors
     */
    handleConfigurationError(
        config: CustomIdHandlerConfig,
        validationErrors: string[],
        context?: Record<string, any>
    ): ErrorResult {
        const errors: IdHandlerError[] = validationErrors.map(error =>
            this.createError(
                ErrorCategory.CONFIGURATION,
                ErrorSeverity.ERROR,
                error,
                {
                    suggestions: this.getConfigurationSuggestions(error, config),
                    code: "CONFIGURATION_INVALID",
                    context: { config, ...context }
                }
            )
        );

        return {
            success: false,
            errors,
            warnings: [],
            infos: [],
            recoverySuggestions: [
                "Review the configuration requirements for custom ID handlers",
                "Ensure all required fields are provided",
                "Check the handler type matches the provided configuration"
            ]
        };
    }

    /**
     * Handle performance warnings
     */
    handlePerformanceWarning(
        executionTime: number,
        handlerId: string,
        context?: Record<string, any>
    ): ErrorResult {
        const severity = executionTime > 1000 ? ErrorSeverity.WARNING : ErrorSeverity.INFO;
        const message = executionTime > 1000
            ? `Handler '${handlerId}' is slow (${executionTime}ms)`
            : `Handler '${handlerId}' execution time: ${executionTime}ms`;

        const warning = this.createError(
            ErrorCategory.PERFORMANCE,
            severity,
            message,
            {
                suggestions: [
                    "Consider optimizing the handler function",
                    "Avoid synchronous I/O operations in handlers",
                    "Cache expensive computations when possible",
                    "Consider using simpler ID generation strategies for high-throughput scenarios"
                ],
                code: "PERFORMANCE_WARNING",
                context: { executionTime, handlerId, ...context }
            }
        );

        return {
            success: true,
            errors: [],
            warnings: severity === ErrorSeverity.WARNING ? [warning] : [],
            infos: severity === ErrorSeverity.INFO ? [warning] : [],
            recoverySuggestions: []
        };
    }

    /**
     * Generate user-friendly error messages for UI display
     */
    formatErrorForUI(error: IdHandlerError): {
        title: string;
        message: string;
        suggestions: string[];
        actionable: boolean;
    } {
        const titles = {
            [ErrorCategory.CONFIGURATION]: "Configuration Error",
            [ErrorCategory.VALIDATION]: "Validation Error",
            [ErrorCategory.EXECUTION]: "Execution Error",
            [ErrorCategory.IMPORT]: "Import Error",
            [ErrorCategory.PERFORMANCE]: "Performance Warning",
            [ErrorCategory.COMPATIBILITY]: "Compatibility Issue"
        };

        return {
            title: titles[error.category],
            message: error.message,
            suggestions: error.suggestions,
            actionable: error.suggestions.length > 0
        };
    }

    /**
     * Generate comprehensive error summary for logging
     */
    generateErrorSummary(result: ErrorResult): string {
        const parts: string[] = [];

        if (result.errors.length > 0) {
            parts.push(`Errors (${result.errors.length}):`);
            result.errors.forEach(error => {
                parts.push(`  - [${error.category}] ${error.message}`);
            });
        }

        if (result.warnings.length > 0) {
            parts.push(`Warnings (${result.warnings.length}):`);
            result.warnings.forEach(warning => {
                parts.push(`  - [${warning.category}] ${warning.message}`);
            });
        }

        if (result.recoverySuggestions.length > 0) {
            parts.push("Recovery Suggestions:");
            result.recoverySuggestions.forEach(suggestion => {
                parts.push(`  - ${suggestion}`);
            });
        }

        return parts.join('\n');
    }

    private generateErrorId(category: ErrorCategory, severity: ErrorSeverity): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 5);
        return `${category}_${severity}_${timestamp}_${random}`;
    }

    private getDefaultSuggestions(category: ErrorCategory, severity: ErrorSeverity): string[] {
        const suggestions: Record<ErrorCategory, Record<ErrorSeverity, string[]>> = {
            [ErrorCategory.CONFIGURATION]: {
                [ErrorSeverity.ERROR]: [
                    "Review the configuration documentation",
                    "Check all required fields are provided",
                    "Validate configuration format"
                ],
                [ErrorSeverity.WARNING]: [
                    "Consider updating configuration for better compatibility"
                ],
                [ErrorSeverity.INFO]: [
                    "Configuration is valid but could be optimized"
                ]
            },
            [ErrorCategory.VALIDATION]: {
                [ErrorSeverity.ERROR]: [
                    "Fix validation errors before proceeding",
                    "Check input data format and types"
                ],
                [ErrorSeverity.WARNING]: [
                    "Address validation warnings for better reliability"
                ],
                [ErrorSeverity.INFO]: [
                    "Validation passed with minor notes"
                ]
            },
            [ErrorCategory.EXECUTION]: {
                [ErrorSeverity.ERROR]: [
                    "Check handler function implementation",
                    "Verify return value types",
                    "Add error handling to handler function"
                ],
                [ErrorSeverity.WARNING]: [
                    "Monitor handler performance in production"
                ],
                [ErrorSeverity.INFO]: [
                    "Handler executed successfully"
                ]
            },
            [ErrorCategory.IMPORT]: {
                [ErrorSeverity.ERROR]: [
                    "Verify import path and file existence",
                    "Check function export names",
                    "Ensure module accessibility"
                ],
                [ErrorSeverity.WARNING]: [
                    "Consider using relative paths for better portability"
                ],
                [ErrorSeverity.INFO]: [
                    "Import resolved successfully"
                ]
            },
            [ErrorCategory.PERFORMANCE]: {
                [ErrorSeverity.ERROR]: [
                    "Optimize handler function for better performance"
                ],
                [ErrorSeverity.WARNING]: [
                    "Monitor performance in production",
                    "Consider caching or optimization"
                ],
                [ErrorSeverity.INFO]: [
                    "Performance is within acceptable limits"
                ]
            },
            [ErrorCategory.COMPATIBILITY]: {
                [ErrorSeverity.ERROR]: [
                    "Update configuration for compatibility"
                ],
                [ErrorSeverity.WARNING]: [
                    "Consider compatibility implications"
                ],
                [ErrorSeverity.INFO]: [
                    "No compatibility issues detected"
                ]
            }
        };

        return suggestions[category]?.[severity] || [];
    }

    private categorizeError(message: string, severity: ErrorSeverity, context?: Record<string, any>): IdHandlerError {
        // Categorize error based on message content
        let category = ErrorCategory.VALIDATION;

        if (message.toLowerCase().includes('import') || message.toLowerCase().includes('module')) {
            category = ErrorCategory.IMPORT;
        } else if (message.toLowerCase().includes('config') || message.toLowerCase().includes('required')) {
            category = ErrorCategory.CONFIGURATION;
        } else if (message.toLowerCase().includes('execution') || message.toLowerCase().includes('runtime')) {
            category = ErrorCategory.EXECUTION;
        } else if (message.toLowerCase().includes('performance') || message.toLowerCase().includes('slow')) {
            category = ErrorCategory.PERFORMANCE;
        }

        return this.createError(category, severity, message, { context });
    }

    private generateRecoverySuggestions(errors: IdHandlerError[], warnings: IdHandlerError[]): string[] {
        const suggestions: string[] = [];

        if (errors.length > 0) {
            suggestions.push("Fix all configuration errors before proceeding");

            const hasImportErrors = errors.some(e => e.category === ErrorCategory.IMPORT);
            if (hasImportErrors) {
                suggestions.push("Verify all import paths and exported functions");
            }

            const hasConfigErrors = errors.some(e => e.category === ErrorCategory.CONFIGURATION);
            if (hasConfigErrors) {
                suggestions.push("Review configuration requirements and provide all required fields");
            }
        }

        if (warnings.length > 0) {
            suggestions.push("Address warnings to improve reliability and performance");
        }

        if (suggestions.length === 0) {
            suggestions.push("Configuration appears valid and ready for use");
        }

        return suggestions;
    }

    private getImportErrorSuggestions(errorMessage: string, importPath: string, functionName?: string): string[] {
        const suggestions: string[] = [];

        if (errorMessage.includes('Cannot resolve module') || errorMessage.includes('Module not found')) {
            suggestions.push(`Verify that the file '${importPath}' exists`);
            suggestions.push("Check the import path is correct relative to the application root");
            suggestions.push("Ensure the file has the correct extension (.js, .ts, .mjs, .cjs)");
        }

        if (errorMessage.includes('not found') && functionName) {
            suggestions.push(`Verify that function '${functionName}' is exported from the module`);
            suggestions.push("Check the function name spelling and case sensitivity");
            suggestions.push("Ensure the function is exported (not just declared)");
        }

        if (errorMessage.includes('permission') || errorMessage.includes('access')) {
            suggestions.push("Check file permissions for the imported module");
            suggestions.push("Ensure the application has read access to the file");
        }

        if (errorMessage.includes('syntax') || errorMessage.includes('parse')) {
            suggestions.push("Check the imported module for syntax errors");
            suggestions.push("Ensure the module uses compatible JavaScript/TypeScript syntax");
        }

        if (suggestions.length === 0) {
            suggestions.push("Check the import path and function name");
            suggestions.push("Verify the module exports the expected function");
            suggestions.push("Test importing the module in a simple script");
        }

        return suggestions;
    }

    private getConfigurationSuggestions(error: string, config: CustomIdHandlerConfig): string[] {
        const suggestions: string[] = [];

        if (error.includes('type') && error.includes('required')) {
            suggestions.push("Set handler type to either 'function' or 'import'");
        }

        if (error.includes('Handler function is required') || (error.includes('handler') && error.includes('required') && config.type === 'function')) {
            suggestions.push("Provide a handler function when type is 'function'");
            suggestions.push("Ensure the function accepts (entity: string, data?: any) parameters");
            suggestions.push("Ensure the function returns string, number, or Promise<string | number>");
        }

        if (error.includes('Import path is required') || (error.includes('importPath') && error.includes('required') && config.type === 'import')) {
            suggestions.push("Provide an import path when type is 'import'");
            suggestions.push("Use relative paths (./path) or package names");
        }

        if (error.includes('Function name is required') || (error.includes('functionName') && error.includes('required') && config.type === 'import')) {
            suggestions.push("Provide a function name when type is 'import'");
            suggestions.push("Use the exact name of the exported function");
        }

        if (suggestions.length === 0) {
            suggestions.push("Review the configuration format requirements");
            suggestions.push("Ensure all required fields for the selected type are provided");
        }

        return suggestions;
    }
}

/**
 * Global error manager instance
 */
export const idHandlerErrorManager = IdHandlerErrorManager.getInstance();