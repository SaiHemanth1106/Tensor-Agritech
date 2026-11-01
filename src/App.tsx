import { useEffect, useState } from "react";

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
import CreateField from "./pages/admin/CreateField";
import RegionManagement from "./pages/admin/RegionManagement";
import UploadCropDetails from "./pages/admin/UploadCropDetails";

export default function App() {
  const [user, setUser] = useState<any>(null);

  const [page, setPage] = useState<string>("");

  // ============================================================
  // RESTORE USER
  // ============================================================

  useEffect(() => {
    const stored =
      localStorage.getItem("user");

    if (!stored) {
      return;
    }

    try {
      setUser(
        JSON.parse(stored)
      );
    } catch {
      localStorage.removeItem(
        "user"
      );
    }
  }, []);

  // ============================================================
  // DEFAULT PAGE
  // ============================================================

  useEffect(() => {
    if (!user) {
      return;
    }

    if (
      user.role === "admin"
    ) {
      setPage(
        "admin-dashboard"
      );
    } else {
      setPage(
        "dashboard"
      );
    }
  }, [user]);

  // ============================================================
  // LOGOUT
  // ============================================================

  const handleLogout = () => {
    localStorage.clear();

    setUser(null);

    setPage("");
  };

  // ============================================================
  // GO TO UPLOAD CROP DETAILS
  // ============================================================

  const handleGoToCropDetails = (
    regionId:
      | string
      | number,

    regionName: string
  ) => {
    localStorage.setItem(
      "pendingCropRegion",

      JSON.stringify({
        regionId:
          String(regionId),

        regionName
      })
    );

    setPage(
      "region-upload-crop-details"
    );
  };

  // ============================================================
  // CROP MAPPING COMPLETE
  // ============================================================

  const handleCropMappingComplete = (
    regionName: string
  ) => {
    localStorage.setItem(
      "lastCompletedRegionName",
      regionName
    );

    localStorage.removeItem(
      "pendingCropRegion"
    );

    setPage(
      "region-management"
    );
  };

  // ============================================================
  // LOGIN
  // ============================================================

  if (!user) {
    return (
      <Login
        setUser={setUser}
      />
    );
  }

  if (!page) {
    return null;
  }

  // ============================================================
  // ADMIN
  // ============================================================

  if (
    user.role === "admin"
  ) {
    return (
      <AdminLayout
        setPage={setPage}
        logout={handleLogout}
      >

        {/* DASHBOARD */}

        {page ===
          "admin-dashboard" && (
          <AdminDashboard />
        )}

        {/* ORGANIZATION */}

        {page ===
          "org-create" && (
          <CreateOrganization />
        )}

        {page ===
          "org-deactivate" && (
          <DeactivateOrganization />
        )}

        {/* USER MANAGEMENT */}

        {page ===
          "user-create" && (
          <CreateUser />
        )}

        {page ===
          "user-deactivate" && (
          <DeactivateUser />
        )}

        {/* CREATE REGION */}

        {page ===
  "region-create" && (
  <CreateRegion />
)}
        {/* CREATE FIELD */}

        {page ===
          "field-create" && (
          <CreateField
            onGoToCropDetails={
              handleGoToCropDetails
            }
          />
        )}

        {/* VIEW REGIONS */}

        {page ===
          "region-management" && (
          <RegionManagement />
        )}

        {/* UPLOAD CROP DETAILS */}

        {page ===
          "region-upload-crop-details" && (
          <UploadCropDetails
            onComplete={
              handleCropMappingComplete
            }
          />
        )}

        {/* DISABLE MONITORING */}

        {page ===
          "region-disable-monitoring" && (
          <DisableMonitoring />
        )}

      </AdminLayout>
    );
  }

  // ============================================================
  // NORMAL USER
  // ============================================================

  return (
    <Layout
      setPage={setPage}
      logout={handleLogout}
      user={user}
    >

      {page ===
        "dashboard" && (
        <Dashboard />
      )}

      {page ===
        "soil" && (
        <SoilHealth />
      )}

      {page ===
        "crop" && (
        <CropHealth />
      )}

      {page ===
        "rec" && (
        <Recommendations />
      )}

      {page ===
        "rec-input" &&
        [
          "scientist",
          "admin"
        ].includes(
          user.role
        ) && (
          <AddRecommendation />
        )}

    </Layout>
  );
}