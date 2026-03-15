import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: ''
  };

  public static getDerivedStateFromError(error: Error): State {
    let message = error.message;
    
    // Check if it's a Firestore JSON error
    try {
      const parsed = JSON.parse(error.message);
      if (parsed.error && parsed.operationType) {
        message = `Mission Control Error: ${parsed.error} during ${parsed.operationType} on ${parsed.path}. Please check your neural link (permissions).`;
      }
    } catch (e) {
      // Not a JSON error, use raw message
    }

    return { hasError: true, errorMessage: message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[999] bg-black flex items-center justify-center p-4 text-center">
          <div className="max-w-md p-8 border-2 border-red-500 rounded-2xl bg-red-500/10 backdrop-blur-md">
            <h2 className="text-2xl font-black text-red-500 mb-4 font-cyber tracking-widest uppercase">System Failure</h2>
            <p className="text-gray-300 mb-6 font-mono text-sm leading-relaxed">
              {this.state.errorMessage}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-red-500 text-white font-black rounded-full hover:bg-red-600 transition-all uppercase tracking-wider"
            >
              Reboot System
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
