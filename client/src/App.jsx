import { Route, Routes } from "react-router-dom";
import RequireAuth from "./components/RequireAuth";
import GroupDetailPage from "./pages/GroupDetailPage";
import GroupsPage from "./pages/GroupsPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RiderProfilePage from "./pages/RiderProfilePage";
import RideScreenPage from "./pages/RideScreenPage";
import RouteBuilderPage from "./pages/RouteBuilderPage";
import SignupPage from "./pages/SignupPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/groups" element={<GroupsPage />} />
      <Route path="/groups/:id" element={<GroupDetailPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/riders/:id" element={<RiderProfilePage />} />
      <Route
        path="/routes/new"
        element={
          <RequireAuth>
            <RouteBuilderPage />
          </RequireAuth>
        }
      />
      <Route
        path="/routes/:id/edit"
        element={
          <RequireAuth>
            <RouteBuilderPage />
          </RequireAuth>
        }
      />
      <Route
        path="/routes/:id/ride"
        element={
          <RequireAuth>
            <RideScreenPage />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
