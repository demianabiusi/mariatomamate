import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught render error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-zinc-950 text-zinc-100 p-6 select-none">
          <div className="max-w-lg w-full p-6 bg-zinc-900 border border-red-500/40 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-100">Error inesperado en la interfaz</h2>
                <p className="text-xs text-zinc-400">Se produjo un fallo al renderizar los componentes.</p>
              </div>
            </div>

            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg font-mono text-xs text-red-300 overflow-auto max-h-48 whitespace-pre-wrap select-text">
              {this.state.error?.message || String(this.state.error)}
              {this.state.error?.stack && `\n\n${this.state.error.stack}`}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold rounded-lg text-xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Recuperar Interfaz
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
