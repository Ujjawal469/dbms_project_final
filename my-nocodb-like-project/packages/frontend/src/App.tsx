// src/App.tsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './login';
import Signup from './signup';
import Dashboard from './dashboard';

function App() {
  return (
    <div> {/* Optional: A root div for layout/styling */}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} /> 
        <Route path="/" element={<Login />} />
        {/* Add a 404 Not Found route later */}
        {/* <Route path="*" element={<div>404 Not Found</div>} /> */}
      </Routes>
    </div>
  );
}

export default App;