import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="metric-card text-center py-10">
          <AlertTriangle className="h-8 w-8 text-status-behind mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-2">Something went wrong</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/80 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
