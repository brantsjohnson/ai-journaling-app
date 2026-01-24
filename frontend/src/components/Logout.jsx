import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const Logout = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <button
      className="px-6 py-2 rounded-full bg-gradient-to-r from-brand-orange to-brand-red text-white hover:shadow-lg hover:shadow-brand-orange/20 font-bold font-sans uppercase text-xs tracking-wider transition-all duration-200"
      onClick={handleLogout}
    >
      Log out
    </button>
  );
};

export default Logout;
