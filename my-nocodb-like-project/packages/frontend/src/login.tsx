import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
// Adjust the import path based on your project structure
// If login.tsx is in src/pages/Login/login.tsx
// and api/index.ts is in src/api/index.ts
// then the path would be '../../api'
import * as api from './api'; // Use the centralized API functions

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // Use null for no error
  const [isLoading, setIsLoading] = useState<boolean>(false); // Optional: For loading state

  // Check login status on component mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const isLoggedIn = await api.checkLoginStatus();
        if (isLoggedIn) {
          console.log("User already logged in, redirecting to Dashboard.");
          navigate("/Dashboard");
        } else {
          console.log("User not logged in.");
          // Stay on login page, no action needed
        }
      } catch (error) {
        // Handle unexpected errors during status check (e.g., network issues)
        // The handleApiError in index.ts already logged the specific error
        console.error("Error checking login status:", error);
        // Optionally set an error message, though often not needed here
        // setErrorMessage("Could not verify login status. Please try logging in.");
      }
    };
    checkStatus();
  }, [navigate]); // Dependency array remains the same

  // Handle input field changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  // Handle form submission for login
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null); // Clear previous errors
    setIsLoading(true); // Set loading state

    try {
      // Call the loginUser API function
      await api.loginUser(formData);
      // If loginUser resolves, login was successful
      console.log("Login successful, navigating to Dashboard.");
      navigate("/Dashboard");
    } catch (error) {
      // loginUser rejected, meaning login failed or another error occurred
      // handleApiError in index.ts already logged details
      // We just need to display the message to the user
      if (error instanceof Error) {
        setErrorMessage(error.message || "Login failed. Please check your credentials.");
      } else {
        setErrorMessage("An unexpected error occurred during login.");
      }
      console.error("Login failed:", error);
    } finally {
      setIsLoading(false); // Reset loading state regardless of outcome
    }
  };

  // --- Styles (keep as they were) ---
  const buttonStyle: React.CSSProperties = {
    backgroundColor: "#555",
    color: "#fff",
    padding: "10px 15px",
    borderRadius: "4px",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
    marginTop: "10px",
    transition: "background-color 0.2s ease-in-out",
    opacity: isLoading ? 0.7 : 1, // Dim button when loading
  };

  const buttonHoverStyle: React.CSSProperties = {
    backgroundColor: "#333",
  };

  // --- JSX Structure (keep as it was) ---
  return (
    <div
      style={{
        backgroundColor: "#f0f0f0",
        padding: "20px",
        borderRadius: "8px",
        width: "300px",
        margin: "40px auto", // Added more top margin
        fontFamily: "Arial, sans-serif",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)", // Added subtle shadow
      }}
    >
      <h2 style={{ color: "#333", textAlign: "center", marginBottom: "20px" }}>
        Login
      </h2>
      {errorMessage && (
        <p style={{ color: "red", marginBottom: "15px", textAlign: "center", fontSize: "0.9em" }}>
          {errorMessage}
        </p>
      )}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
        <div style={{ display: "flex", flexDirection: "column"}}>
          <label htmlFor="email" style={{ color: "#555", marginBottom: "5px", fontWeight: "bold" }}>
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
              padding: "10px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              backgroundColor: "#fff",
              color: "#333",
              fontSize: '1em',
            }}
            disabled={isLoading} // Disable input while loading
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column"}}>
          <label htmlFor="password" style={{ color: "#555", marginBottom: "5px", fontWeight: "bold" }}>
            Password:
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter your password"
            required // Added required attribute
            style={{
              padding: "10px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              backgroundColor: "#fff",
              color: "#333",
              fontSize: '1em',
            }}
            disabled={isLoading} // Disable input while loading
          />
        </div>
        <button
          type="submit"
          style={buttonStyle}
          onMouseOver={(e) => {
            if (!isLoading) { // Only change style if not loading
                (e.target as HTMLButtonElement).style.backgroundColor = buttonHoverStyle.backgroundColor;
            }
          }}
          onMouseOut={(e) => {
             (e.target as HTMLButtonElement).style.backgroundColor = buttonStyle.backgroundColor;
          }}
          disabled={isLoading} // Disable button when loading
        >
          {isLoading ? "Logging in..." : "Login"}
        </button>
      </form>
      <p style={{ marginTop: "20px", textAlign: "center", color: "#555", fontSize: "0.9em" }}>
        Don't have an account? <Link to="/signup" style={{ color: "#007bff", textDecoration: 'none' }}>Sign up here</Link>
      </p>
    </div>
  );
};

export default Login;