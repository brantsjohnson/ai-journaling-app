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
