import {
  useEffect,
  useState,
} from "react";

// ============================================================
// AUTH
// ============================================================

import Login from "./pages/Login";

// ============================================================
// LAYOUTS
// ============================================================

import Layout from "./components/Layout";
import AdminLayout from "./components/AdminLayout";

// ============================================================
// USER PAGES
// ============================================================

import Dashboard from "./pages/Dashboard";
import SoilHealth from "./pages/SoilHealth";
import CropHealth from "./pages/CropHealth";
import Recommendations from "./pages/Recommendations";
import AddRecommendation from "./pages/AddRecommendation";

// ============================================================
// ADMIN PAGES
// ============================================================

import AdminDashboard from "./pages/admin/AdminDashboard";

import CreateOrganization from "./pages/admin/CreateOrganization";
import DeactivateOrganization from "./pages/admin/DeactivateOrganization";

import CreateUser from "./pages/admin/CreateUser";
import DeactivateUser from "./pages/admin/DeactivateUser";

import CreateRegion from "./pages/admin/CreateRegion";
import CreateFields from "./pages/admin/CreateField";
import RegionManagement from "./pages/admin/RegionManagement";
import UploadCropDetails from "./pages/admin/UploadCropDetails";
import DisableMonitoring from "./pages/admin/DisableMonitoring";

// ============================================================
// TYPES
// ============================================================

interface AppUser {
  id?: number | string;

  user_id?: number | string;

  username?: string;

  role?: string;

  organization_id?:
    | number
    | string;

  organizationId?:
    | number
    | string;

  [key: string]: unknown;
}

// ============================================================
// APP
// ============================================================

function App() {
  const [
    user,
    setUser,
  ] = useState<AppUser | null>(
    null
  );

  const [
    page,
    setPage,
  ] = useState<string>("");

  const [
    initialized,
    setInitialized,
  ] = useState(false);

  // ==========================================================
  // RESTORE LOGIN
  // ==========================================================

  useEffect(() => {
    try {
      const storedUser =
        localStorage.getItem(
          "user"
        );

      if (storedUser) {
        const parsedUser =
          JSON.parse(
            storedUser
          );

        setUser(
          parsedUser
        );
      }
    } catch (error) {
      console.error(
        "Unable to restore user:",
        error
      );

      localStorage.removeItem(
        "user"
      );
    } finally {
      setInitialized(true);
    }
  }, []);

  // ==========================================================
  // DEFAULT PAGE AFTER LOGIN / REFRESH
  // ==========================================================

  useEffect(() => {
    if (!user) {
      return;
    }

    if (page) {
      return;
    }

    if (
      String(
        user.role
      ).toLowerCase() ===
      "admin"
    ) {
      setPage(
        "admin-dashboard"
      );

      return;
    }

    setPage(
      "dashboard"
    );
  }, [
    user,
    page,
  ]);

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout =
    () => {
      localStorage.clear();

      setUser(null);

      setPage("");
    };

  // ==========================================================
  // CREATE REGION -> CREATE FIELDS
  //
  // Create Region success ayyaka
  // direct ga Create Fields page ki vellali.
  // ==========================================================

  const handleGoToCreateFields =
    () => {
      setPage(
        "field-create"
      );
    };

  // ==========================================================
  // CREATE FIELDS -> UPLOAD CROP DETAILS
  //
  // Create Fields Lambda success ayyaka
  // region ID + region name save chestham.
  // ==========================================================

  const handleRegionCreated = (
    regionId:
      | string
      | number,

    regionName: string
  ) => {
    localStorage.setItem(
      "pendingCropRegion",
      JSON.stringify({
        regionId:
          String(
            regionId
          ),

        regionName,
      })
    );

    setPage(
      "region-upload-crop-details"
    );
  };

  // ==========================================================
  // CROP MAPPING COMPLETE
  // ==========================================================

  const handleCropMappingComplete =
    (
      regionName: string
    ) => {
      localStorage.setItem(
        "lastCompletedRegionName",
        regionName
      );

      setPage(
        "region-management"
      );
    };

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  if (!initialized) {
    return null;
  }

  // ==========================================================
  // NOT LOGGED IN
  //
  // IMPORTANT:
  // Existing Login.tsx expects setUser.
  // ==========================================================

  if (!user) {
    return (
      <Login
        setUser={setUser}
      />
    );
  }

  // ==========================================================
  // ADMIN
  // ==========================================================

  if (
    String(
      user.role
    ).toLowerCase() ===
    "admin"
  ) {
    return (
      <AdminLayout
        setPage={
          setPage
        }
        logout={
          handleLogout
        }
      >
        {/* ====================================================
            ADMIN DASHBOARD
        ==================================================== */}

        {page ===
          "admin-dashboard" && (
          <AdminDashboard />
        )}

        {/* ====================================================
            ORGANIZATION MANAGEMENT
        ==================================================== */}

        {page ===
          "organization-create" && (
          <CreateOrganization />
        )}

        {page ===
          "organization-deactivate" && (
          <DeactivateOrganization />
        )}

        {/* ====================================================
            USER MANAGEMENT
        ==================================================== */}

        {page ===
          "user-create" && (
          <CreateUser />
        )}

        {page ===
          "user-deactivate" && (
          <DeactivateUser />
        )}

        {/* ====================================================
            REGION MANAGEMENT
        ==================================================== */}

        {/* CREATE REGION
            Success ->
            CREATE FIELDS
        */}

        {page ===
          "region-create" && (
          <CreateRegion
            onGoToCreateFields={
              handleGoToCreateFields
            }
          />
        )}

        {/* CREATE FIELDS
            Success ->
            UPLOAD CROP DETAILS
        */}

        {page ===
          "field-create" && (
          <CreateFields
            onGoToCropDetails={
              handleRegionCreated
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

  // ==========================================================
  // NORMAL USER / SCIENTIST
  // ==========================================================

  return (
    <Layout
      setPage={
        setPage
      }
      logout={
        handleLogout
      }
      user={
        user
      }
    >
      {page ===
        "dashboard" && (
        <Dashboard />
      )}

      {page ===
        "soil-health" && (
        <SoilHealth />
      )}

      {page ===
        "crop-health" && (
        <CropHealth />
      )}

      {page ===
        "recommendations" && (
        <Recommendations />
      )}

      {page ===
        "add-recommendation" && (
        <AddRecommendation />
      )}
    </Layout>
  );
}

export default App;