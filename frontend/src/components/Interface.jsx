import { useAuth } from "../contexts/AuthContext";
import { useEffect, useContext } from "react";
import { UserIdContext} from "./UserIdContext"
import Transcript from "./Transcript";
import EntryList from "./EntryList";
import Logout from "./Logout";

const Sidebar = () => {
  const { user, token } = useAuth();
  const { userId, setUserId } = useContext(UserIdContext);

  // Set userId from authenticated user
  useEffect(() => {
    if (user && user.id) {
      // Set userId directly from user.id (can be UUID or numeric)
      // Backend will handle conversion via JWT token
      setUserId(user.id);
      console.log('User ID set:', user.id);
    }
  }, [user, setUserId]);

  return (
    <div className="min-h-screen bg-brand-dark">
      {/* Header */}
      <div className="bg-brand-dark shadow-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white font-display uppercase tracking-wide" style={{ textShadow: "0 2px 0 #B31F19" }}>
              Journal
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-full bg-stone-700 hover:bg-stone-600 text-white font-semibold font-sans uppercase text-xs tracking-wider transition-all duration-200 flex items-center gap-2"
              title="Refresh page"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              Refresh
            </button>
            <Logout />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Top Section - Recording Controls */}
        <EntryList showRecordingControls={true} />
        
        <div className="mt-6">
          {/* Transcript Panel - Full Width */}
          <Transcript />
        </div>
      </div>
    </div>
  );
} 

export default Sidebar;
