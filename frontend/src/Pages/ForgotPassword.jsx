import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "../config/api";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resetLink, setResetLink] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const response = await axios.post(API_BASE + "/auth/forgot-password", {
        email,
      });

      if (response.data.status === "success") {
        setSuccess(true);
        // In development, show the reset link
        if (response.data.resetLink) {
          setResetLink(response.data.resetLink);
        }
      }
    } catch (err) {
      console.error("Forgot password error:", err);
      setError(
        err.response?.data?.message || "Failed to send reset email. Please try again."
      );
    } finally {
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
            FORGOT PASSWORD?
          </h2>

          <p className="font-sans font-medium text-white text-[16px] leading-[24px] mb-8 text-left">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-[#FDEAEA] border border-brand-red rounded-lg">
              <p className="text-brand-red text-sm text-center">{error}</p>
            </div>
          )}

          {success ? (
            <div className="mb-4 p-4 bg-green-100 border border-green-400 rounded-lg">
              <p className="text-green-800 text-sm text-center mb-2">
                Password reset link has been sent to your email!
              </p>
              {resetLink && (
                <div className="mt-4 p-3 bg-white rounded-lg">
                  <p className="text-xs text-gray-600 mb-2">Development Mode - Reset Link:</p>
                  <a
                    href={resetLink}
                    className="text-blue-600 text-xs break-all hover:underline"
                  >
                    {resetLink}
                  </a>
                </div>
              )}
              <div className="mt-4 text-center">
                <Link
                  to="/"
                  className="text-brand-orange text-sm hover:underline"
                >
                  Back to Login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 mb-4 px-4 bg-white text-black rounded-[20px]"
                required
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-white font-sans font-bold uppercase rounded-[20px] text-[16px] bg-gradient-to-r from-brand-orange to-brand-red"
              >
                {loading ? "SENDING..." : "SEND RESET LINK"}
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

export default ForgotPassword;

