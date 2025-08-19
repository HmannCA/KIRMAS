import React from 'react';

export class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean; msg?: string}> {
  constructor(props: any){ super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(err: any){ return { hasError: true, msg: String(err) }; }
  componentDidCatch(err: any, info: any){ console.error('UI ErrorBoundary:', err, info); }
  render(){
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16 }}>
          <h2>Es ist ein Fehler aufgetreten.</h2>
          <p>Bitte Eingabe prüfen oder erneut versuchen.</p>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.msg}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
