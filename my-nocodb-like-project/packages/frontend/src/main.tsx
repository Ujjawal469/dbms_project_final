// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // Only need BrowserRouter here
import App from './App'; // Import the main App component

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter> {/* Router context wraps the entire App */}
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);