import { Landing, Profile, Dashboard, ForgotPassword, ResetPassword } from "./Pages";
import { BrowserRouter as Router, Route, Routes} from "react-router-dom";
import { EntryIdProvider, UserIdProvider, SelectedentryIdProvider, SelectedEntryProvider, ScriptProvider } from "./components";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

const App = () => {
  return (
    <AuthProvider>
      <UserIdProvider>
        <EntryIdProvider>
          <SelectedentryIdProvider>
            <SelectedEntryProvider>
              <ScriptProvider>
              <Router>
                <Routes>
                  <Route exact path='/' element={<Landing/>}></Route>
                  <Route exact path='/forgot-password' element={<ForgotPassword/>}></Route>
                  <Route exact path='/reset-password' element={<ResetPassword/>}></Route>
                  <Route exact path='/me' element={
                    <ProtectedRoute>
                      <Dashboard/>
                    </ProtectedRoute>
                  }></Route>
                  <Route exact path='/profile' element={
                    <ProtectedRoute>
                      <Profile/>
                    </ProtectedRoute>
                  }></Route>
                </Routes>
              </Router> 
              </ScriptProvider>
            </SelectedEntryProvider>
          </SelectedentryIdProvider>
        </EntryIdProvider>
      </UserIdProvider>
    </AuthProvider>
  );
};

export default App;
