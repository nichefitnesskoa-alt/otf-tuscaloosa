import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Copy } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleCopyDebug = () => {
    const debugStr = [
      `Error: ${this.state.error?.message}`,
      `Stack: ${this.state.error?.stack?.slice(0, 500)}`,
      `Component: ${this.state.errorInfo?.componentStack?.slice(0, 300)}`,
      `URL: ${window.location.href}`,
      `Time: ${new Date().toISOString()}`,
      `UA: ${navigator.userAgent}`,
    ].join('\n');
    navigator.clipboard.writeText(debugStr).then(() => {
      alert('Debug info copied to clipboard');
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
          <h2 className="text-lg font-semibold mb-2">
            {this.props.fallbackTitle || 'Something went wrong'}
          </h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <div className="flex gap-2">
            <Button onClick={this.handleReload} size="sm" className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              Reload
            </Button>
            <Button onClick={this.handleCopyDebug} variant="outline" size="sm" className="gap-1.5">
              <Copy className="w-3.5 h-3.5" />
              Copy Debug Info
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
