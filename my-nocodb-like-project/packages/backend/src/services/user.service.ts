// src/services/user.service.ts

import { prisma } from '../config/db'; // Adjust path if your db.ts is elsewhere
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client'; // Import Prisma types

// Consider defining these interfaces in a shared types file (e.g., src/types/user.types.ts)
export interface SignupCredentials {
  username: string;
  email: string;
  password: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// Type for the user object returned (excluding password)
// Using Prisma's generated type and Omit utility type
export type SafeUser = Omit<Prisma.usersGetPayload<{}>, 'password_hash'>;


const SALT_ROUNDS = 10; // Cost factor for bcrypt hashing

/**
 * Creates a new user in the database.
 * @param credentials - User signup information.
 * @returns The newly created user object (without password hash).
 * @throws Error if email is already taken or validation fails.
 */
export const signup = async (credentials: SignupCredentials): Promise<SafeUser> => {
  const { username, email, password } = credentials;

  // 1. Basic Input Validation (can be enhanced)
  if (!username || !email || !password) {
    throw new Error('Username, email, and password are required.');
  }
  // Add email format validation if desired

  // 2. Check if email already exists
  const existingUser = await prisma.users.findUnique({
    where: { email },
  });

  if (existingUser) {
    // Use a specific error type or message distinguishable by the controller/handler
    const error = new Error('Email address is already in use.');
    (error as any).statusCode = 409; // Conflict
    throw error;
  }

  // 3. Hash the password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // 4. Create the user
  try {
    const newUser = await prisma.users.create({
      data: {
        username,
        email,
        password_hash: passwordHash,
      },
    });

    // 5. Return safe user data (exclude password hash)
    const { password_hash, ...safeUserData } = newUser;
    return safeUserData;

  } catch (error) {
    console.error("Error during user creation:", error);
    // Handle potential Prisma errors (e.g., constraint violations caught late)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Example: Re-check for unique constraint just in case (though findUnique should catch it)
         if (error.code === 'P2002') {
             const conflictError = new Error('Email address is already in use (database constraint).');
             (conflictError as any).statusCode = 409;
             throw conflictError;
         }
    }
    // Throw a generic error for other DB issues
    throw new Error('Failed to create user due to a database error.');
  }
};

/**
 * Authenticates a user based on email and password.
 * @param credentials - User login information.
 * @returns The authenticated user object (without password hash).
 * @throws Error if login fails (user not found, invalid password).
 */
export const login = async (credentials: LoginCredentials): Promise<SafeUser> => {
  const { email, password } = credentials;

  // 1. Basic Input Validation
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  // 2. Find user by email
  const user = await prisma.users.findUnique({
    where: { email },
  });

  if (!user) {
    const error = new Error('Invalid email or password.'); // Keep messages generic for security
    (error as any).statusCode = 401; // Unauthorized
    throw error;
  }

  // 3. Compare provided password with stored hash
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    const error = new Error('Invalid email or password.'); // Keep messages generic
    (error as any).statusCode = 401; // Unauthorized
    throw error;
  }

  // 4. Return safe user data
  const { password_hash, ...safeUserData } = user;
  return safeUserData;
};

/**
 * Finds a user by their ID.
 * @param userId - The ID of the user to find.
 * @returns The user object (without password hash) or null if not found.
 */
export const findUserById = async (userId: number): Promise<SafeUser | null> => {
    const user = await prisma.users.findUnique({
        where: { user_id: userId },
    });

    if (!user) {
        return null;
    }

    const { password_hash, ...safeUserData } = user;
    return safeUserData;
};