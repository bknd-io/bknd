import React from "react";
import { 
  TbAlertCircle, 
  TbExclamationMark, 
  TbInfoCircle, 
  TbBulb, 
  TbRefresh,
  TbClipboard,
  TbChevronDown,
  TbChevronRight
} from "react-icons/tb";
import { Alert } from "./Alert";
import type { ErrorResult } from "data/fields/IdHandlerErrorManager";

interface IdHandlerErrorDisplayProps {
  errorResult: ErrorResult;
  title?: string;
  showRecovery?: boolean;
  onRetry?: () => void;
  onCopyError?: () => void;
  className?: string;
}

export function IdHandlerErrorDisplay({
  errorResult,
  title = "Custom ID Handler Issue",
  showRecovery = true,
  onRetry,
  onCopyError,
  className = ""
}: IdHandlerErrorDisplayProps) {
  const [showDetails, setShowDetails] = React.useState(false);
  const [showSuggestions, setShowSuggestions] = React.useState(false);

  const hasErrors = errorResult.errors.length > 0;
  const hasWarnings = errorResult.warnings.length > 0;
  const hasInfos = errorResult.infos.length > 0;

  // Determine the primary alert type
  const AlertComponent = hasErrors ? Alert.Exception : hasWarnings ? Alert.Warning : Alert.Info;
  const primaryIcon = hasErrors ? TbExclamationMark : hasWarnings ? TbAlertCircle : TbInfoCircle;

  const handleCopyError = () => {
    const errorText = [
      `${title}`,
      `Status: ${errorResult.success ? 'Success with warnings' : 'Failed'}`,
      '',
      ...(errorResult.errors.length > 0 ? [
        'Errors:',
        ...errorResult.errors.map(error => `- ${error.message}`)
      ] : []),
      ...(errorResult.warnings.length > 0 ? [
        'Warnings:',
        ...errorResult.warnings.map(warning => `- ${warning.message}`)
      ] : []),
      ...(errorResult.recoverySuggestions.length > 0 ? [
        '',
        'Recovery Suggestions:',
        ...errorResult.recoverySuggestions.map((suggestion, index) => `${index + 1}. ${suggestion}`)
      ] : [])
    ].join('\n');

    navigator.clipboard.writeText(errorText).then(() => {
      console.log('Error details copied to clipboard');
    });

    if (onCopyError) {
      onCopyError();
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <AlertComponent className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <primaryIcon.type size={16} />
            <span className="font-medium">{title}</span>
          </div>
          <div className="flex items-center gap-1">
            {onCopyError && (
              <button
                onClick={handleCopyError}
                className="p-1 hover:bg-black/5 rounded transition-colors"
                title="Copy error details"
              >
                <TbClipboard size={14} />
              </button>
            )}
            {onRetry && (
              <button
                onClick={onRetry}
                className="p-1 hover:bg-black/5 rounded transition-colors"
                title="Retry operation"
              >
                <TbRefresh size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="text-sm">
          {hasErrors && (
            <div className="text-red-800">
              {errorResult.errors.length} error{errorResult.errors.length !== 1 ? 's' : ''} found that must be resolved.
            </div>
          )}
          {hasWarnings && (
            <div className="text-yellow-800">
              {errorResult.warnings.length} warning{errorResult.warnings.length !== 1 ? 's' : ''} that should be addressed.
            </div>
          )}
          {hasInfos && (
            <div className="text-blue-800">
              {errorResult.infos.length} informational message{errorResult.infos.length !== 1 ? 's' : ''}.
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 text-xs">
          {(hasErrors || hasWarnings) && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 px-2 py-1 bg-black/5 hover:bg-black/10 rounded transition-colors"
            >
              {showDetails ? <TbChevronDown size={12} /> : <TbChevronRight size={12} />}
              Show Details
            </button>
          )}
          {errorResult.recoverySuggestions.length > 0 && showRecovery && (
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="flex items-center gap-1 px-2 py-1 bg-black/5 hover:bg-black/10 rounded transition-colors"
            >
              <TbBulb size={12} />
              {showSuggestions ? 'Hide' : 'Show'} Recovery Steps
            </button>
          )}
        </div>

        {/* Detailed Error Information */}
        {showDetails && (hasErrors || hasWarnings || hasInfos) && (
          <div className="space-y-3 border-t pt-3">
            {/* Errors */}
            {errorResult.errors.length > 0 && (
              <div>
                <div className="font-medium text-red-800 mb-2 flex items-center gap-1">
                  <TbExclamationMark size={14} />
                  Errors ({errorResult.errors.length})
                </div>
                <div className="space-y-2">
                  {errorResult.errors.map((error, index) => (
                    <div key={index} className="border-l-2 border-red-300 pl-3">
                      <div className="text-sm font-medium text-red-800">{error.message}</div>
                      {error.details && (
                        <div className="text-xs text-red-600 mt-1 font-mono bg-red-50 p-2 rounded">
                          {error.details}
                        </div>
                      )}
                      {error.suggestions.length > 0 && (
                        <div className="mt-2">
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
              </div>
            )}

            {/* Warnings */}
            {errorResult.warnings.length > 0 && (
              <div>
                <div className="font-medium text-yellow-800 mb-2 flex items-center gap-1">
                  <TbAlertCircle size={14} />
                  Warnings ({errorResult.warnings.length})
                </div>
                <div className="space-y-2">
                  {errorResult.warnings.map((warning, index) => (
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
              </div>
            )}

            {/* Info Messages */}
            {errorResult.infos.length > 0 && (
              <div>
                <div className="font-medium text-blue-800 mb-2 flex items-center gap-1">
                  <TbInfoCircle size={14} />
                  Information ({errorResult.infos.length})
                </div>
                <div className="space-y-1">
                  {errorResult.infos.map((info, index) => (
                    <div key={index} className="text-sm text-blue-700 border-l-2 border-blue-300 pl-3">
                      {info.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recovery Suggestions */}
        {showSuggestions && errorResult.recoverySuggestions.length > 0 && showRecovery && (
          <div className="border-t pt-3">
            <div className="font-medium mb-2 flex items-center gap-1">
              <TbBulb size={14} />
              Recovery Steps
            </div>
            <div className="bg-black/5 rounded p-3">
              <ol className="list-decimal list-inside space-y-1 text-sm">
                {errorResult.recoverySuggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </AlertComponent>
    </div>
  );
}

/**
 * Compact version for inline display
 */
export function IdHandlerErrorSummary({
  errorResult,
  className = ""
}: {
  errorResult: ErrorResult;
  className?: string;
}) {
  const hasErrors = errorResult.errors.length > 0;
  const hasWarnings = errorResult.warnings.length > 0;

  if (!hasErrors && !hasWarnings) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      {hasErrors && (
        <div className="flex items-center gap-1 text-red-600">
          <TbExclamationMark size={12} />
          <span>{errorResult.errors.length} error{errorResult.errors.length !== 1 ? 's' : ''}</span>
        </div>
      )}
      {hasWarnings && (
        <div className="flex items-center gap-1 text-yellow-600">
          <TbAlertCircle size={12} />
          <span>{errorResult.warnings.length} warning{errorResult.warnings.length !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}