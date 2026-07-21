import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// Sets data-theme on <html> at import time, before the first paint.
import './lib/theme';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
