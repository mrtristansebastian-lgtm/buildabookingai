import React from 'react';
import { reportClientError } from '../services/errorReporting';

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Build A Booking recovered from a render error.', {
      message: error?.message || String(error),
      stack: error?.stack,
      source: this.props.label || 'react-boundary',
      componentStack: info?.componentStack
    });
    reportClientError(error, {
      source: this.props.label || 'react-boundary',
      info
    });
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    if (this.props.compact) {
      return (
        <section className="min-h-[18rem] w-full rounded-2xl border border-neutral-200 bg-white p-6 flex flex-col items-center justify-center text-center shadow-xl shadow-black/5">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400 mb-3">{this.props.label || 'Section Recovery'}</p>
          <h2 className="text-2xl font-bold tracking-tight mb-3">This area paused safely.</h2>
          <p className="text-sm leading-relaxed text-neutral-500 max-w-md mb-5">
            The rest of the workspace is still running. Your latest local edits are kept on this device.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="h-11 px-6 rounded-full bg-black text-white text-[10px] font-bold uppercase tracking-widest"
          >
            Retry Section
          </button>
        </section>
      );
    }

    return (
      <main className="min-h-screen bg-white text-black flex items-center justify-center p-6">
        <section className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-2xl shadow-black/5">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400 mb-4">Workspace Recovery</p>
          <h1 className="text-3xl font-black tracking-tight leading-none mb-4">Something paused for a second.</h1>
          <p className="text-sm leading-relaxed text-neutral-500 mb-6">
            Your workspace is safe. Refresh the app and Build A Booking will reload the latest saved data.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-12 w-full rounded-lg bg-black text-white text-[10px] font-bold uppercase tracking-widest"
          >
            Refresh Workspace
          </button>
        </section>
      </main>
    );
  }
}
