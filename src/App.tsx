import { useState, useEffect } from "react";
import Login from "./pages/Login";

// USER LAYOUT
import Layout from "./components/Layout";

// ADMIN LAYOUT
import AdminLayout from "./components/AdminLayout";

// USER PAGES
import Dashboard from "./pages/Dashboard";
import SoilHealth from "./pages/SoilHealth";
import CropHealth from "./pages/CropHealth";
import Recommendations from "./pages/Recommendations";
import AddRecommendation from "./pages/AddRecommendation";

// ADMIN PAGES
import AdminDashboard from "./pages/admin/AdminDashboard";
import CreateOrganization from "./pages/admin/CreateOrganization";
import DeactivateOrganization from "./pages/admin/DeactivateOrganization";
import CreateUser from "./pages/admin/CreateUser";
import DeactivateUser from "./pages/admin/DeactivateUser";
import DisableMonitoring from "./pages/admin/DisableMonitoring";
import CreateRegion from "./pages/admin/CreateRegion";
import RegionManagement from "./pages/admin/RegionManagement";
import UploadCropDetails from "./pages/admin/UploadCropDetails";

export default function App() {

  const [user, setUser] = useState<any>(null);
  const [page, setPage] = useState<string>(""); // ✅ EMPTY INIT

  // 🔄 Restore user on refresh
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      const parsed = JSON.parse(stored);
      setUser(parsed);
    }
  }, []);

  // ✅ CENTRALIZED REDIRECT LOGIC
  useEffect(() => {
    if (!user) return;

    if (user.role === "admin") {
      setPage("admin-dashboard");
    } else {
      setPage("dashboard");
    }
  }, [user]);

  // 🚪 Logout
  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setPage("");
  };

  // 🔐 Login fallback
  if (!user) {
    return <Login setUser={setUser} />;
  }

  // ⏳ Prevent render before page is set
  if (!page) {
    return null;
  }

  // ================= ADMIN VIEW =================
  if (user.role === "admin") {
    return (
      <AdminLayout setPage={setPage} logout={handleLogout}>

        {page === "admin-dashboard" && <AdminDashboard />}

        {page === "org-create" && <CreateOrganization />}
        {page === "org-deactivate" && <DeactivateOrganization />}

        {page === "user-create" && <CreateUser />}
        {page === "user-deactivate" && <DeactivateUser />}

        {page === "region-create" && <CreateRegion />}
        {page === "region-management" && <RegionManagement />}
        {page === "region-upload-crop-details" && <UploadCropDetails />}
        {page === "region-disable-monitoring" && <DisableMonitoring />}

      </AdminLayout>
    );
  }

  // ================= USER VIEW =================
  return (
    <Layout setPage={setPage} logout={handleLogout} user={user}>

      {page === "dashboard" && <Dashboard />}
      {page === "soil" && <SoilHealth />}
      {page === "crop" && <CropHealth />}
      {page === "rec" && <Recommendations />}

      {page === "rec-input" &&
        ["scientist", "admin"].includes(user.role) && (
          <AddRecommendation />
        )}

    </Layout>
  );
}
