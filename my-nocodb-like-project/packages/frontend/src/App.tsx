// src/App.tsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './login'; // Adjust path if needed
import Signup from './signup'; // Adjust path if needed
import Dashboard from './dashboard';
// Import Dashboard later
// import Dashboard from './Dashboard';

function App() {
  return (
    <div> {/* Optional: A root div for layout/styling */}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} /> 
        {/* Add a default route, maybe redirecting to login or dashboard */}
        <Route path="/" element={<Login />} /> {/* Example: Default to login */}
        {/* Add a 404 Not Found route later */}
        {/* <Route path="*" element={<div>404 Not Found</div>} /> */}
      </Routes>
    </div>
  );
}

export default App;