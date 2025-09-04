import { idHandlerErrorManager, type ErrorResult } from "../fields/IdHandlerErrorManager";
import type { CustomIdHandlerConfig } from "../fields/PrimaryField";

/**
 * Entity-specific error handling for custom ID handlers
 */
export class EntityErrorHandler {
  private entityName: string;

  constructor(entityName: string) {
    this.entityName = entityName;
  }

  /**
   * Handle entity configuration validation errors
   */
  handleConfigurationValidation(
    customHandler?: CustomIdHandlerConfig,
    primaryFormat?: string
  ): ErrorResult | null {
    const errors: string[] = [];

    if (customHandler && primaryFormat !== "custom") {
      errors.push(
        `Entity "${this.entityName}": custom_id_handler is configured but primary_format is not set to "custom". ` +
        "Set primary_format to 'custom' when using custom ID handlers."
      );
    }

    if (!customHandler && primaryFormat === "custom") {
      errors.push(
        `Entity "${this.entityName}": primary_format is set to "custom" but no custom_id_handler is configured. ` +
        "Either provide a custom handler configuration or change primary_format to 'integer' or 'uuid'."
      );
    }

    if (customHandler) {
      // Validate handler type
      if (!customHandler.type || !["function", "import"].includes(customHandler.type)) {
        errors.push(
          `Entity "${this.entityName}": Invalid handler type '${customHandler.type}'. ` +
          "Must be 'function' for inline handlers or 'import' for external modules."
        );
      }

      // Validate function type configuration
      if (customHandler.type === "function" && !customHandler.handler) {
        errors.push(
          `Entity "${this.entityName}": Handler function is required when type is "function". ` +
          "Provide a function that accepts (entity: string, data?: any) and returns string | number | Promise<string | number>."
        );
      }

      // Validate import type configuration
      if (customHandler.type === "import") {
        if (!customHandler.importPath) {
          errors.push(
            `Entity "${this.entityName}": Import path is required when type is "import". ` +
            "Provide the path to the module containing your ID handler function."
          );
        }
        if (!customHandler.functionName) {
          errors.push(
            `Entity "${this.entityName}": Function name is required when type is "import". ` +
            "Specify the name of the exported function to use as the ID handler."
          );
        }
      }
    }

    if (errors.length === 0) {
      return null;
    }

    return idHandlerErrorManager.handleConfigurationError(
      customHandler || {} as CustomIdHandlerConfig,
      errors,
      { entityName: this.entityName, primaryFormat }
    );
  }

  /**
   * Handle handler registration errors
   */
  handleRegistrationError(error: Error, customHandler: CustomIdHandlerConfig): ErrorResult {
    const suggestions = [
      "Check that the handler function is valid and properly defined",
      "Ensure the handler doesn't conflict with existing handlers",
      "Verify the handler configuration is correct",
      "Try restarting the application if the issue persists"
    ];

    if (customHandler.type === "import") {
      suggestions.push(
        "Verify the import path and function name are correct",
        "Ensure the external module is accessible",
        "Check that the function is properly exported"
      );
    }

    return idHandlerErrorManager.handleExecutionError(
      error,
      `entity_${this.entityName}`,
      this.entityName,
      { 
        operation: "registration",
        handlerConfig: customHandler,
        suggestions
      }
    );
  }

  /**
   * Generate user-friendly error messages for entity configuration
   */
  formatConfigurationError(errorResult: ErrorResult): {
    title: string;
    message: string;
    details: string[];
    suggestions: string[];
    severity: 'error' | 'warning' | 'info';
  } {
    const hasErrors = errorResult.errors.length > 0;
    const hasWarnings = errorResult.warnings.length > 0;

    let severity: 'error' | 'warning' | 'info' = 'info';
    if (hasErrors) severity = 'error';
    else if (hasWarnings) severity = 'warning';

    const title = hasErrors 
      ? `Configuration Error in Entity "${this.entityName}"`
      : hasWarnings
      ? `Configuration Warning in Entity "${this.entityName}"`
      : `Entity "${this.entityName}" Configuration`;

    const message = hasErrors
      ? "The custom ID handler configuration has errors that must be fixed before the entity can be used."
      : hasWarnings
      ? "The custom ID handler configuration has warnings that should be addressed."
      : "The custom ID handler configuration is valid.";

    const details: string[] = [];
    errorResult.errors.forEach(error => details.push(`❌ ${error.message}`));
    errorResult.warnings.forEach(warning => details.push(`⚠️ ${warning.message}`));
    errorResult.infos.forEach(info => details.push(`ℹ️ ${info.message}`));

    const suggestions: string[] = [];
    
    // Collect suggestions from all errors and warnings
    [...errorResult.errors, ...errorResult.warnings].forEach(item => {
      suggestions.push(...item.suggestions);
    });

    // Add recovery suggestions
    suggestions.push(...errorResult.recoverySuggestions);

    // Remove duplicates
    const uniqueSuggestions = Array.from(new Set(suggestions));

    return {
      title,
      message,
      details,
      suggestions: uniqueSuggestions,
      severity
    };
  }

  /**
   * Log comprehensive error information for debugging
   */
  logError(errorResult: ErrorResult, operation: string): void {
    const formatted = this.formatConfigurationError(errorResult);
    
    console.group(`🔧 Entity Error: ${this.entityName} (${operation})`);
    console.log(`Severity: ${formatted.severity.toUpperCase()}`);
    console.log(`Message: ${formatted.message}`);
    
    if (formatted.details.length > 0) {
      console.log("Details:");
      formatted.details.forEach(detail => console.log(`  ${detail}`));
    }
    
    if (formatted.suggestions.length > 0) {
      console.log("Suggestions:");
      formatted.suggestions.forEach((suggestion, index) => 
        console.log(`  ${index + 1}. ${suggestion}`)
      );
    }
    
    console.groupEnd();
  }

  /**
   * Create a recovery plan for common configuration issues
   */
  createRecoveryPlan(errorResult: ErrorResult): {
    steps: string[];
    canAutoRecover: boolean;
    autoRecoveryAction?: () => void;
  } {
    const steps: string[] = [];
    let canAutoRecover = false;
    let autoRecoveryAction: (() => void) | undefined;

    // Analyze errors to create specific recovery steps
    const hasConfigMismatch = errorResult.errors.some(error => 
      error.message.includes("primary_format") && error.message.includes("custom_id_handler")
    );

    const hasMissingHandler = errorResult.errors.some(error =>
      error.message.includes("Handler function is required")
    );

    const hasMissingImportConfig = errorResult.errors.some(error =>
      error.message.includes("Import path is required") || 
      error.message.includes("Function name is required")
    );

    if (hasConfigMismatch) {
      steps.push("Fix the mismatch between primary_format and custom_id_handler configuration");
      steps.push("Either set primary_format to 'custom' or remove the custom_id_handler");
      canAutoRecover = true;
      autoRecoveryAction = () => {
        console.log(`Auto-recovery: Would set primary_format to 'custom' for entity ${this.entityName}`);
      };
    }

    if (hasMissingHandler) {
      steps.push("Provide a valid handler function for inline custom ID generation");
      steps.push("Ensure the function accepts (entity: string, data?: any) parameters");
      steps.push("Ensure the function returns string, number, or Promise<string | number>");
    }

    if (hasMissingImportConfig) {
      steps.push("Complete the import configuration with both importPath and functionName");
      steps.push("Verify the import path points to an accessible module");
      steps.push("Verify the function name matches an exported function");
    }

    // Add general recovery steps if no specific issues found
    if (steps.length === 0) {
      steps.push("Review the custom ID handler configuration");
      steps.push("Check the documentation for configuration examples");
      steps.push("Test the configuration with sample data");
    }

    return {
      steps,
      canAutoRecover,
      autoRecoveryAction
    };
  }
}

/**
 * Create an entity error handler for a specific entity
 */
export function createEntityErrorHandler(entityName: string): EntityErrorHandler {
  return new EntityErrorHandler(entityName);
}