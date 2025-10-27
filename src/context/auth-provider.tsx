"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { onAuthStateChanged, User, getIdToken } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Cookies from "js-cookie";

// Define the shape of the context state
type AuthContextType = {
  user: User | null;
  loading: boolean;
};

// This is the name of the cookie our middleware will look for
const AUTH_TOKEN_COOKIE = "firebase-auth-token";

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create the provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);

      if (user) {
        // User is signed in. Get their ID token.
        const token = await getIdToken(user);
        
        // Set the token as a cookie for the middleware to read.
        Cookies.set(AUTH_TOKEN_COOKIE, token, {
          expires: 7, // Cookie expiration in days
          secure: process.env.NODE_ENV === "production", // Only use HTTPS in production
          sameSite: "lax", // Recommended for security
        });
      } else {
        // User is signed out. Remove the cookie.
        Cookies.remove(AUTH_TOKEN_COOKIE);
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  return (
    // This now renders children immediately, fixing the "blank page"
    // on the login route. The loading state is passed down for
    // protected pages to use.
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Create a custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};