'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props { children: ReactNode; fallbackMessage?: string }
interface State { hasError: boolean; error: string }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle size={32} className="text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Algo deu errado</h2>
          <p className="text-sm text-slate-500 mb-4 text-center max-w-md">
            {this.props.fallbackMessage || 'Ocorreu um erro inesperado. Tente recarregar a página.'}
          </p>
          <p className="text-xs text-slate-400 mb-4 font-mono">{this.state.error}</p>
          <button onClick={() => { this.setState({ hasError: false, error: '' }); window.location.reload(); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            <RotateCcw size={14} /> Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
