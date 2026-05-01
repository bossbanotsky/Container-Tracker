import React from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl border border-gray-100 text-center">
            <div className="flex flex-col items-center">
              <div className="bg-red-50 p-4 rounded-full mb-6">
                <AlertTriangle className="h-12 w-12 text-red-600" />
              </div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
                Something went wrong
              </h1>
              <p className="text-gray-500 text-sm mb-8">
                An unexpected error occurred. We've logged the issue and are looking into it.
              </p>
              
              {this.state.error && (
                <div className="w-full bg-gray-50 rounded-lg p-4 mb-8 text-left border border-gray-200">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                    Error Detail
                  </p>
                  <p className="text-xs font-mono text-red-800 break-words line-clamp-3">
                    {this.state.error.toString()}
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <Button 
                  onClick={this.handleReset}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98]"
                >
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button 
                  variant="outline"
                  onClick={this.handleGoHome}
                  className="flex-1 border-gray-200 text-gray-600 font-bold py-6 rounded-xl transition-all active:scale-[0.98]"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Button>
              </div>
            </div>
            
            <div className="pt-6 border-t border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                ContainerRepairPro v1.0.0
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
