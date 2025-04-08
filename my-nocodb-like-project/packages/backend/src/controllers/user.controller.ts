// src/controllers/user.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service'; // Adjust path if needed
import { SafeUser } from '../services/user.service'; // Import the SafeUser type

// Augment Express Request type to include session data (if using express-session)
// You might want to put this in a global .d.ts file (e.g., src/types/express/index.d.ts)
declare module 'express-session' {
  interface SessionData {
    userId?: number; // Store user ID in session
    user?: SafeUser; // Optionally store safe user details
  }
}


/**
 * Handles user signup requests.
 */
export const signup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, email, password } = req.body;

    // Basic validation (service layer has more robust checks)
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required.' });
    }

    const newUser = await userService.signup({ username, email, password });

    // --- Session Management: Log the user in immediately after signup ---
    // Ensure express-session middleware is configured in server.ts
    // --------------------------------------------------------------------

    console.log(`User signed up: ${newUser.username} (ID: ${newUser.user_id})`);
    res.status(201).json({ message: 'Signup successful!', user: newUser });

  } catch (error: any) {
     // Log the detailed error on the server
     console.error("Signup Controller Error:", error.message);
     // Let the global error handler manage the response status and message
     next(error);
  }
};

/**
 * Handles user login requests.
 */
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await userService.login({ email, password });

    // --- Session Management: Create session on successful login ---
    // Ensure express-session middleware is configured in server.ts
    req.session.userId = user.user_id;
    req.session.user = user; // Store safe user data in session
    // ---------------------------------------------------------------

    console.log(`User logged in: ${user.username} (ID: ${user.user_id})`);
    res.status(200).json({ message: 'Login successful!', user: user });

  } catch (error: any) {
     // Log the detailed error on the server
     console.error("Login Controller Error:", error.message);
     // Let the global error handler manage the response status and message
     next(error);
  }
};

/**
 * Checks if the user is currently logged in via session.
 */
export const isLoggedIn = async (req: Request, res: Response) => {
  // Check if session exists and has userId (requires express-session middleware)
  if (req.session && req.session.userId) {
    // Optionally: Fetch fresh user data if needed, otherwise use session data
    const userFromSession = req.session.user; // Use user data stored during login/signup

    if (userFromSession) {
         console.log(`User is logged in (from session): ${userFromSession.username}`);
         return res.status(200).json({ loggedIn: true, user: userFromSession });
    } else {
        // Fallback: If user data isn't in session, fetch it (less efficient)
        try {
            const user = await userService.findUserById(req.session.userId);
            if (user) {
                 console.log(`User is logged in (fetched by ID): ${user.username}`);
                 // Optionally store it back in session
                 req.session.user = user;
                 return res.status(200).json({ loggedIn: true, user: user });
            } else {
                 // User ID in session but not in DB? Session invalid. Destroy it.
                 console.warn(`User ID ${req.session.userId} found in session but not in DB. Destroying session.`);
                 req.session.destroy((err) => {
                     if (err) console.error("Error destroying invalid session:", err);
                     res.clearCookie('connect.sid'); // Adjust cookie name if needed
                     return res.status(401).json({ loggedIn: false, message: "Invalid session." });
                 });
            }
        } catch(fetchError) {
             console.error("Error fetching user during isLoggedIn check:", fetchError);
             return res.status(500).json({ loggedIn: false, message: "Error checking login status." });
        }
    }

  } else {
    // No session or userId in session
    console.log("User is not logged in (no valid session).");
    return res.status(401).json({ loggedIn: false, message: "User not logged in" }); // Use 401 Unauthorized
  }
};

/**
 * Handles user logout requests.
 */
export const logout = (req: Request, res: Response, next: NextFunction) => {
  // Destroy the session (requires express-session middleware)
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      // Pass error to global handler or send specific response
      return next(new Error('Failed to logout. Please try again.'));
      // Or: return res.status(500).json({ message: 'Logout failed.' });
    }

    // Clear the session cookie client-side
    // The cookie name 'connect.sid' is the default for express-session. Change if you configured differently.
    res.clearCookie('connect.sid'); // Adjust cookie name if needed

    console.log("User logged out successfully.");
    res.status(200).json({ message: 'Logout successful!' });
  });
};