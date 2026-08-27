import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-xs text-muted">
          <div className="mb-2 text-2xl">⚠️</div>
          <p className="font-bold text-text mb-1">终端渲染异常</p>
          <p className="text-red-400 font-mono mb-3">{this.state.error?.message || '未知错误'}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="rounded-lg bg-accent px-3 py-1.5 text-white"
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
