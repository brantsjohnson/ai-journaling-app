import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import { API_BASE } from "../config/api";
import { supabase } from "../config/supabase";

const Landing = () => {
  const [formData, setFormData] = useState({ email: "", password: "", name: "" });
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { user, login, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // If user is already authenticated, send them to the dashboard
  useEffect(() => {
    if (!authLoading && user) {
      navigate("/me");
    }
  }, [user, authLoading, navigate]);

  // Handle OAuth callback - sync Google user with backend
  useEffect(() => {
    const syncGoogleUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session && session.user.app_metadata.provider === 'google') {
        try {
          // Sync with backend
          const response = await axios.post(API_BASE + '/auth/sync-supabase-user', {
            email: session.user.email,
            name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email,
            supabase_id: session.user.id
          });

          if (response.data.status === 'success') {
            login(response.data.data.user, response.data.data.token);
          }
        } catch (err) {
          console.error('Error syncing Google user:', err);
        }
      }
    };

    syncGoogleUser();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      setError("Please fill in all fields");
      return;
    }

    if (isSignup && !formData.name) {
      setError("Please fill in all fields including name");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const endpoint = isSignup ? "/auth/signup" : "/auth/login";
      const payload = isSignup
        ? { email: formData.email, password: formData.password, name: formData.name }
        : { email: formData.email, password: formData.password };

      const response = await axios.post(API_BASE + endpoint, payload);

      if (response.data.status === "success") {
        // Store user and token
        login(response.data.data.user, response.data.data.token);
        // Navigate to dashboard
        navigate("/me");
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError(
        err.response?.data?.message || 
        (isSignup ? "Signup failed. Please try again." : "Login failed. Please check your credentials.")
      );
      setLoading(false);
    }
  };

  const handleSignUp = () => {
    setIsSignup(true);
    setError("");
  };

  // Google OAuth sign in
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/me`,
        },
      });

      if (error) {
        console.error("Google sign-in error:", error);
        setError("Failed to sign in with Google. Please try again.");
        setLoading(false);
      }
      // Note: The redirect will happen automatically, so we don't need to navigate manually
    } catch (err) {
      console.error("Google sign-in error:", err);
      setError("Failed to sign in with Google. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex justify-center"
      style={{
        background:
          "linear-gradient(45deg, #443628 0%, #ED8A50 44%, #BF341E 100%)",
      }}
    >
      <div className="w-full max-w-[430px] min-h-[932px] flex flex-col">
        {/* Header */}
        <div className="pt-16 text-center px-6">
          {/* Intentionally no subtitle text here */}
          <h1
            className="mt-2 font-display text-[80px] uppercase text-brand-dark"
            style={{ textShadow: "0 4px 0 #B31F19" }}
          >
            Journal
          </h1>
        </div>

        {/* Dark Sheet */}
        <div className="mt-8 rounded-t-[20px] px-6 pt-8 pb-10 flex-1 shadow-lg bg-brand-dark">
          <h2 className="font-sans font-bold text-center uppercase text-white text-[22px] mb-6">
            WELCOME!
          </h2>

          <p className="font-sans font-medium text-white text-[20px] leading-[24px] mb-8 text-left">
            {isSignup ? "Sign up" : "Log in"}
          </p>

          {/* Google Sign-in */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full h-12 mb-4 bg-white text-gray-body font-sans font-medium hover:bg-gray-50 
                       transition disabled:opacity-50 rounded-[20px] text-[16px] flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {loading ? "Signing in..." : "SignUp/Login with Google"}
          </button>

          {/* Divider */}
          <div className="flex items-center my-6">
            <hr className="flex-grow border-gray-body" />
            <span className="px-2 font-sans font-normal text-gray-body text-[14px]">
              or
            </span>
            <hr className="flex-grow border-gray-body" />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-[#FDEAEA] border border-brand-red rounded-lg">
              <p className="text-brand-red text-sm text-center">{error}</p>
            </div>
          )}

          {/* Email Login/Signup */}
          <form onSubmit={handleSubmit}>
            {isSignup && (
              <input
                type="text"
                name="name"
                placeholder="Name"
                value={formData.name}
                onChange={handleChange}
                className="w-full h-12 mb-4 px-4 bg-white text-black rounded-[20px]"
                required
              />
            )}

            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              className="w-full h-12 mb-4 px-4 bg-white text-black rounded-[20px]"
              required
            />

            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              className="w-full h-12 mb-2 px-4 bg-white text-black rounded-[20px]"
              required
            />

            <div className="text-right mb-6">
              <Link
                to="/forgot-password"
                className="font-sans font-normal underline text-gray-body text-[14px]"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-white font-sans font-bold uppercase rounded-[20px] text-[16px] bg-gradient-to-r from-brand-orange to-brand-red"
            >
              {loading ? "PROCESSING..." : isSignup ? "SIGN UP" : "LOG IN"}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            {isSignup ? (
              <>
                <span className="font-sans font-normal text-gray-body text-[16px]">
                  Already have an account?{" "}
                </span>
                <span
                  onClick={() => {
                    setIsSignup(false);
                    setError("");
                  }}
                  className="cursor-pointer hover:underline font-sans font-normal text-brand-orange text-[16px]"
                >
                  Log in
                </span>
              </>
            ) : (
              <>
                <span className="font-sans font-normal text-gray-body text-[16px]">
                  Don't have an account?{" "}
                </span>
                <span
                  onClick={handleSignUp}
                  className="cursor-pointer hover:underline font-sans font-normal text-brand-orange text-[16px]"
                >
                  Sign up
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;
