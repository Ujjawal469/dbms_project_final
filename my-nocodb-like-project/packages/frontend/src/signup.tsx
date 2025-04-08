// signup.tsx

import React, { useState, useEffect } from "react";
// --- Corrected and Combined Imports ---
import { useNavigate, Link } from "react-router-dom";
// --- Import API functions ---
// Adjust path if signup.tsx is not in the same directory as login.tsx relative to the api folder
import * as api from './api';

const Signup = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });
  // --- Use null for no error, matching login.tsx ---
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // --- Added isLoading state ---
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Check login status on component mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        // --- Use API function ---
        const isLoggedIn = await api.checkLoginStatus();
        if (isLoggedIn) {
          console.log("User already logged in, redirecting to Dashboard.");
          navigate("/Dashboard");
        } else {
          console.log("User not logged in.");
          // Stay on signup page
        }
      } catch (error) {
        // Error is already logged by handleApiError in index.ts
        console.error("Error checking login status on signup page:", error);
        // Optionally set a generic error for the user if status check fails unexpectedly
        // setErrorMessage("Could not verify login status.");
      }
    };
    checkStatus();
  }, [navigate]);

  // Handle input field changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { // <-- Added type
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  // Handle form submission for signup
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => { // <-- Added type
    e.preventDefault();
    setErrorMessage(null); // Clear previous errors
    setIsLoading(true);    // Set loading state

    try {
      // --- Use API function ---
      await api.signupUser(formData);
      // If signupUser resolves, signup was successful
      console.log("Signup successful, navigating to Dashboard.");
      navigate("/Login");
    } catch (error) {
      // signupUser rejected, meaning signup failed or another error occurred
      // handleApiError in index.ts already logged details
      // Display the message from the error thrown by the API function
      if (error instanceof Error) {
        setErrorMessage(error.message || "Signup failed. Please check your input.");
      } else {
        setErrorMessage("An unexpected error occurred during signup.");
      }
      console.error("Signup failed:", error);
    } finally {
      setIsLoading(false); // Reset loading state regardless of outcome
    }
  };

  // --- Styles (minor adjustments for consistency if needed, kept original for now) ---
   const buttonStyle: React.CSSProperties = {
    backgroundColor: "#555",
    color: "#fff",
    padding: "10px 15px",
    borderRadius: "4px",
    border: "none",
    cursor: isLoading ? 'not-allowed' : 'pointer', // Change cursor when loading
    fontSize: "16px",
    marginTop: "10px",
    transition: "background-color 0.2s ease-in-out, opacity 0.2s ease-in-out", // Added opacity transition
    opacity: isLoading ? 0.7 : 1, // Dim button when loading
  };

  const buttonHoverStyle: React.CSSProperties = {
    backgroundColor: "#333",
  };

  // --- JSX Structure ---
  return (
    <div
      style={{
        backgroundColor: "#f0f0f0",
        padding: "20px",
        borderRadius: "8px",
        width: "300px",
        margin: "40px auto", // Matched login margin
        fontFamily: "Arial, sans-serif",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)", // Matched login shadow
      }}
    >
      <h2 style={{ color: "#333", textAlign: "center", marginBottom: "20px" }}> {/* Matched login margin */}
        Sign Up
      </h2>
      {errorMessage && (
        <p style={{ color: "red", marginBottom: "15px", textAlign: "center", fontSize: '0.9em' }}> {/* Matched login style */}
          {errorMessage}
        </p>
      )}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px" }}> {/* Matched login gap */}
        {/* Username Input */}
        <div style={{ display: "flex", flexDirection: "column"}}>
          <label htmlFor="username" style={{ color: "#555", marginBottom: "5px", fontWeight: 'bold' }}> {/* Matched login style */}
            Username:
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            placeholder="Choose a username" // Slightly different placeholder
            required // Added required attribute
            style={{
              padding: "10px", // Matched login padding
              borderRadius: "4px",
              border: "1px solid #ccc",
              backgroundColor: "#fff",
              color: "#333",
              fontSize: '1em', // Matched login font size
            }}
            disabled={isLoading} // Disable input while loading
          />
        </div>
        {/* Email Input */}
        <div style={{ display: "flex", flexDirection: "column"}}>
          <label htmlFor="email" style={{ color: "#555", marginBottom: "5px", fontWeight: 'bold' }}> {/* Matched login style */}
            Email:
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter your email"
            required // Added required attribute
            style={{
              padding: "10px", // Matched login padding
              borderRadius: "4px",
              border: "1px solid #ccc",
              backgroundColor: "#fff",
              color: "#333",
              fontSize: '1em', // Matched login font size
            }}
            disabled={isLoading} // Disable input while loading
          />
        </div>
        {/* Password Input */}
        <div style={{ display: "flex", flexDirection: "column"}}>
          <label htmlFor="password" style={{ color: "#555", marginBottom: "5px", fontWeight: 'bold' }}> {/* Matched login style */}
            Password:
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Create a password" // Slightly different placeholder
            required // Added required attribute
            style={{
              padding: "10px", // Matched login padding
              borderRadius: "4px",
              border: "1px solid #ccc",
              backgroundColor: "#fff",
              color: "#333",
              fontSize: '1em', // Matched login font size
            }}
            disabled={isLoading} // Disable input while loading
          />
        </div>
        {/* Submit Button */}
        <button
          type="submit"
          style={buttonStyle}
          onMouseOver={(e) => {
            // --- Prevent hover effect when loading ---
            if (!isLoading) {
              (e.target as HTMLButtonElement).style.backgroundColor = buttonHoverStyle.backgroundColor;
            }
          }}
          onMouseOut={(e) => {
             (e.target as HTMLButtonElement).style.backgroundColor = buttonStyle.backgroundColor;
          }}
          disabled={isLoading} // Disable button when loading
        >
          {/* --- Change button text when loading --- */}
          {isLoading ? "Signing up..." : "Sign Up"}
        </button>
      </form>
      {/* Link to Login */}
      <p style={{ marginTop: "20px", textAlign: "center", color: "#555", fontSize: "0.9em" }}> {/* Matched login style */}
        Already have an account? <Link to="/login" style={{ color: "#007bff", textDecoration: 'none' }}>Login here</Link> {/* Matched login style */}
      </p>
    </div>
  );
};

export default Signup;