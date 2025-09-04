import { describe, it, expect, beforeEach } from "vitest";
import { 
  IdHandlerErrorManager, 
  ErrorCategory, 
  ErrorSeverity,
  type ErrorResult 
} from "../IdHandlerErrorManager";
import type { ValidationResult } from "../IdHandlerRegistry";
import type { CustomIdHandlerConfig } from "../PrimaryField";

describe("IdHandlerErrorManager", () => {
  let errorManager: IdHandlerErrorManager;

  beforeEach(() => {
    errorManager = IdHandlerErrorManager.getInstance();
  });

  describe("createError", () => {
    it("should create a structured error with suggestions", () => {
      const error = errorManager.createError(
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.ERROR,
        "Test error message",
        {
          details: "Additional details",
          suggestions: ["Fix this", "Try that"],
          code: "TEST_ERROR"
        }
      );

      expect(error.category).toBe(ErrorCategory.CONFIGURATION);
      expect(error.severity).toBe(ErrorSeverity.ERROR);
      expect(error.message).toBe("Test error message");
      expect(error.details).toBe("Additional details");
      expect(error.suggestions).toEqual(["Fix this", "Try that"]);
      expect(error.code).toBe("TEST_ERROR");
      expect(error.id).toMatch(/configuration_error_/);
    });

    it("should provide default suggestions when none are provided", () => {
      const error = errorManager.createError(
        ErrorCategory.VALIDATION,
        ErrorSeverity.WARNING,
        "Test warning"
      );

      expect(error.suggestions.length).toBeGreaterThan(0);
      expect(error.suggestions[0]).toContain("validation");
    });
  });

  describe("processValidationResult", () => {
    it("should convert validation result to structured error result", () => {
      const validationResult: ValidationResult = {
        valid: false,
        errors: ["Configuration is invalid", "Missing required field"],
        warnings: ["Performance may be impacted"]
      };

      const errorResult = errorManager.processValidationResult(validationResult, {
        entityName: "test_entity"
      });

      expect(errorResult.success).toBe(false);
      expect(errorResult.errors).toHaveLength(2);
      expect(errorResult.warnings).toHaveLength(1);
      expect(errorResult.recoverySuggestions.length).toBeGreaterThan(0);
      
      // Check that context is preserved
      expect(errorResult.errors[0].context).toEqual({ entityName: "test_entity" });
    });

    it("should handle successful validation", () => {
      const validationResult: ValidationResult = {
        valid: true,
        errors: [],
        warnings: ["Minor optimization suggestion"]
      };

      const errorResult = errorManager.processValidationResult(validationResult);

      expect(errorResult.success).toBe(true);
      expect(errorResult.errors).toHaveLength(0);
      expect(errorResult.warnings).toHaveLength(1);
    });
  });

  describe("handleExecutionError", () => {
    it("should create structured execution error with fallback suggestions", () => {
      const error = new Error("Handler function threw an exception");
      const errorResult = errorManager.handleExecutionError(
        error,
        "test-handler",
        "test_entity",
        { data: { test: true } }
      );

      expect(errorResult.success).toBe(false);
      expect(errorResult.errors).toHaveLength(1);
      expect(errorResult.errors[0].category).toBe(ErrorCategory.EXECUTION);
      expect(errorResult.errors[0].message).toContain("Handler 'test-handler' execution failed");
      expect(errorResult.recoverySuggestions).toContain(
        "The system will automatically fall back to UUID generation"
      );
    });
  });

  describe("handleImportError", () => {
    it("should provide specific suggestions for module not found errors", () => {
      const error = new Error("Cannot resolve module './non-existent-module'");
      const errorResult = errorManager.handleImportError(
        error,
        "./non-existent-module",
        "generateId"
      );

      expect(errorResult.success).toBe(false);
      expect(errorResult.errors[0].category).toBe(ErrorCategory.IMPORT);
      expect(errorResult.errors[0].suggestions).toContain(
        "Verify that the file './non-existent-module' exists"
      );
    });

    it("should provide function-specific suggestions when function name is provided", () => {
      const error = new Error("Function 'wrongName' not found");
      const errorResult = errorManager.handleImportError(
        error,
        "./valid-module",
        "wrongName"
      );

      expect(errorResult.errors[0].suggestions).toContain(
        "Verify that function 'wrongName' is exported from the module"
      );
    });
  });

  describe("handleConfigurationError", () => {
    it("should provide specific suggestions for configuration errors", () => {
      const config: CustomIdHandlerConfig = {
        type: "function"
        // Missing handler function
      };

      const errorResult = errorManager.handleConfigurationError(
        config,
        ["Handler function is required when type is 'function'"],
        { entityName: "test_entity" }
      );

      expect(errorResult.success).toBe(false);
      expect(errorResult.errors[0].suggestions).toContain(
        "Provide a handler function when type is 'function'"
      );
    });
  });

  describe("handlePerformanceWarning", () => {
    it("should create warning for slow handlers", () => {
      const errorResult = errorManager.handlePerformanceWarning(
        1500, // 1.5 seconds
        "slow-handler"
      );

      expect(errorResult.success).toBe(true);
      expect(errorResult.warnings).toHaveLength(1);
      expect(errorResult.warnings[0].category).toBe(ErrorCategory.PERFORMANCE);
      expect(errorResult.warnings[0].message).toContain("slow (1500ms)");
    });

    it("should create info for acceptable performance", () => {
      const errorResult = errorManager.handlePerformanceWarning(
        150, // 150ms
        "acceptable-handler"
      );

      expect(errorResult.success).toBe(true);
      expect(errorResult.infos).toHaveLength(1);
      expect(errorResult.infos[0].message).toContain("execution time: 150ms");
    });
  });

  describe("formatErrorForUI", () => {
    it("should format error for user interface display", () => {
      const error = errorManager.createError(
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.ERROR,
        "Invalid configuration",
        { suggestions: ["Fix config", "Check docs"] }
      );

      const formatted = errorManager.formatErrorForUI(error);

      expect(formatted.title).toBe("Configuration Error");
      expect(formatted.message).toBe("Invalid configuration");
      expect(formatted.suggestions).toEqual(["Fix config", "Check docs"]);
      expect(formatted.actionable).toBe(true);
    });
  });

  describe("generateErrorSummary", () => {
    it("should generate comprehensive error summary for logging", () => {
      const errorResult: ErrorResult = {
        success: false,
        errors: [
          errorManager.createError(
            ErrorCategory.CONFIGURATION,
            ErrorSeverity.ERROR,
            "Config error"
          )
        ],
        warnings: [
          errorManager.createError(
            ErrorCategory.PERFORMANCE,
            ErrorSeverity.WARNING,
            "Performance warning"
          )
        ],
        infos: [],
        recoverySuggestions: ["Fix the config", "Restart the service"]
      };

      const summary = errorManager.generateErrorSummary(errorResult);

      expect(summary).toContain("Errors (1):");
      expect(summary).toContain("Config error");
      expect(summary).toContain("Warnings (1):");
      expect(summary).toContain("Performance warning");
      expect(summary).toContain("Recovery Suggestions:");
      expect(summary).toContain("Fix the config");
    });
  });

  describe("error categorization", () => {
    it("should correctly categorize import-related errors", () => {
      const error = errorManager.createError(
        ErrorCategory.IMPORT,
        ErrorSeverity.ERROR,
        "Failed to import module"
      );

      expect(error.category).toBe(ErrorCategory.IMPORT);
      expect(error.suggestions).toContain(
        "Verify import path and file existence"
      );
    });

    it("should correctly categorize execution-related errors", () => {
      const error = errorManager.createError(
        ErrorCategory.EXECUTION,
        ErrorSeverity.ERROR,
        "Handler execution failed"
      );

      expect(error.category).toBe(ErrorCategory.EXECUTION);
      expect(error.suggestions).toContain(
        "Check handler function implementation"
      );
    });
  });

  describe("recovery suggestions", () => {
    it("should provide appropriate recovery suggestions for different error types", () => {
      const configError = errorManager.createError(
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.ERROR,
        "Invalid config"
      );

      const importError = errorManager.createError(
        ErrorCategory.IMPORT,
        ErrorSeverity.ERROR,
        "Import failed"
      );

      expect(configError.suggestions).toContain(
        "Review the configuration documentation"
      );
      expect(importError.suggestions).toContain(
        "Verify import path and file existence"
      );
    });
  });
});