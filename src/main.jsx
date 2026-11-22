import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import AppErrorBoundary from './components/AppErrorBoundary';
import BackendLoader from './components/BackendLoader';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <HashRouter>
        <BackendLoader>
          <App />
        </BackendLoader>
      </HashRouter>
    </AppErrorBoundary>
  </React.StrictMode>,
);
