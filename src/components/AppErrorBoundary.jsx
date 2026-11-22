import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import Button from './ui/Button';

export default class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="container-app flex min-h-screen items-center justify-center py-16">
        <section className="card max-w-lg p-8 text-center" role="alert">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-600" aria-hidden="true" />
          <h1 className="mt-5 font-heading text-2xl font-bold text-navy">The page could not be displayed</h1>
          <p className="mt-3 text-sm leading-6 text-muted">An unexpected interface error occurred. Reload the application to try again; your saved account data is not affected.</p>
          <Button className="mt-6" onClick={() => window.location.reload()}><RotateCcw className="h-4 w-4" />Reload SignTrans</Button>
        </section>
      </main>
    );
  }
}
