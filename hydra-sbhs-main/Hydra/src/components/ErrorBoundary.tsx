import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * ErrorBoundary catches render-time exceptions anywhere in its subtree and
 * displays a recovery UI instead of unmounting the whole React tree.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <WeekView />
 *   </ErrorBoundary>
 *
 * Optionally supply a custom `fallback` prop to override the default message.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console so DevTools still shows the full stack.
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack);
  }

  handleReset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="error-state" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ marginBottom: '0.75rem' }}>
            Something went wrong while rendering this view.
          </p>
          <pre style={{ fontSize: 12, opacity: 0.7, whiteSpace: 'pre-wrap', marginBottom: '1rem' }}>
            {error.message}
          </pre>
          <button onClick={this.handleReset}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
