import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Suppress benign Vite HMR WebSocket errors in this environment
const isBenignViteError = (msg: string) => {
  return msg && (
    msg.includes('WebSocket closed without opened') ||
    msg.includes('failed to connect to websocket') ||
    msg.includes('WebSocket connection to')
  );
};

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && isBenignViteError(event.reason.message)) {
    event.preventDefault();
    event.stopPropagation();
  }
});

window.onerror = (message) => {
  if (typeof message === 'string' && isBenignViteError(message)) {
    return true; // Prevent default browser handling
  }
  return false;
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);