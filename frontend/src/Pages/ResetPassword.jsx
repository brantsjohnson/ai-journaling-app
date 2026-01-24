import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "../config/api";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setError("Invalid reset link. Please request a new password reset.");
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      setError("Invalid reset link. Please request a new password reset.");
      return;
    }

    if (!password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await axios.post(API_BASE + "/auth/reset-password", {
        token,
        password,
      });

      if (response.data.status === "success") {
        setSuccess(true);
        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate("/");
        }, 2000);
      }
    } catch (err) {
      console.error("Reset password error:", err);
      setError(
        err.response?.data?.message || "Failed to reset password. Please try again."
      );
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
          <h1
            className="mt-2 font-display text-[80px] uppercase text-brand-dark"
            style={{ textShadow: "0 4px 0 #B31F19" }}
          >
            RESET
          </h1>
        </div>

        {/* Dark Sheet */}
        <div className="mt-8 rounded-t-[20px] px-6 pt-8 pb-10 flex-1 shadow-lg bg-brand-dark">
          <h2 className="font-sans font-bold text-center uppercase text-white text-[22px] mb-6">
            RESET PASSWORD
          </h2>

          <p className="font-sans font-medium text-white text-[16px] leading-[24px] mb-8 text-left">
            Enter your new password below.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-[#FDEAEA] border border-brand-red rounded-lg">
              <p className="text-brand-red text-sm text-center">{error}</p>
            </div>
          )}

          {success ? (
            <div className="mb-4 p-4 bg-green-100 border border-green-400 rounded-lg">
              <p className="text-green-800 text-sm text-center">
                Password reset successfully! Redirecting to login...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <input
                type="password"
                name="password"
                placeholder="New Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 mb-4 px-4 bg-white text-black rounded-[20px]"
                required
                minLength={6}
              />

              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full h-12 mb-4 px-4 bg-white text-black rounded-[20px]"
                required
                minLength={6}
              />

              <button
                type="submit"
                disabled={loading || !token}
                className="w-full h-12 text-white font-sans font-bold uppercase rounded-[20px] text-[16px] bg-gradient-to-r from-brand-orange to-brand-red"
              >
                {loading ? "RESETTING..." : "RESET PASSWORD"}
              </button>
            </form>
          )}

          {/* Footer */}
          <div className="mt-6 text-center">
            <Link
              to="/"
              className="font-sans font-normal text-brand-orange text-[16px] hover:underline"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

