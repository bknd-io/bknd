import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
   children: ReactNode;
   suppressError?: boolean;
   fallback?:
      | (({ error, resetError }: { error: Error; resetError: () => void }) => ReactNode)
      | ReactNode;
}

interface ErrorBoundaryState {
   hasError: boolean;
   error?: Error | undefined;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
   constructor(props: ErrorBoundaryProps) {
      super(props);
      this.state = { hasError: false, error: undefined };
   }

   static getDerivedStateFromError(error: Error): ErrorBoundaryState {
      return { hasError: true, error };
   }

   override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
      const type = this.props.suppressError ? "warn" : "error";
      console[type]("ErrorBoundary caught an error:", error, errorInfo);
   }

   resetError = () => {
      this.setState({ hasError: false, error: undefined });
   };

   private renderFallback() {
      if (this.props.fallback) {
         return typeof this.props.fallback === "function" ? (
            this.props.fallback({ error: this.state.error!, resetError: this.resetError })
         ) : (
            <BaseError>{this.props.fallback}</BaseError>
         );
      }
      return <BaseError>{this.state.error?.message ?? "Unknown error"}</BaseError>;
   }

   override render() {
      if (this.state.hasError) {
         return this.renderFallback();
      }

      if (this.props.suppressError) {
         try {
            return this.props.children;
         } catch (e) {
            return this.renderFallback();
         }
      }

      return this.props.children;
   }
}

const BaseError = ({ children }: { children: ReactNode }) => (
   <div className="bg-red-700 text-white py-1 px-2 rounded-md leading-tight font-mono">
      {children}
   </div>
);

export default ErrorBoundary;
