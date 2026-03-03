import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { applyTheme } from './lib/theme.js';

applyTheme();

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '2rem', fontFamily: 'monospace', background: '#0a0c0f',
          color: '#ff4560', minHeight: '100vh', whiteSpace: 'pre-wrap', wordBreak: 'break-all'
        }}>
          <h2>Runtime Error</h2>
          <p>{this.state.error?.message}</p>
          <p style={{color:'#64748b', fontSize:'.85rem'}}>{this.state.error?.stack}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
