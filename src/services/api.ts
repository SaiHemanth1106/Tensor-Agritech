import axios from "axios";

const BASE_URL = "https://171oyca6o7.execute-api.ap-south-1.amazonaws.com";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000
});

// ==============================
// 🔐 REQUEST INTERCEPTOR
// ==============================
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ==============================
// 🔐 RESPONSE INTERCEPTOR
// ==============================
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API ERROR:", error);

    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = "/";
    }

    return Promise.reject(error);
  }
);

// ==============================
// 🧰 SAFE HANDLER (🔥 FIXED)
// ==============================
const handle = async (promise: Promise<any>) => {
  try {
    const res = await promise;
    let data = res.data;

    // ✅ Lambda proxy response
    if (data && typeof data === "object" && "body" in data) {
      data =
        typeof data.body === "string"
          ? JSON.parse(data.body)
          : data.body;
    }

    // ✅ Sometimes body itself is string
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        // ignore
      }
    }

    return data;

  } catch (err: any) {
    console.error("HANDLE ERROR:", err);

    // ✅ ALWAYS RETURN SAFE ERROR
    return Promise.reject({
      message:
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Something went wrong"
    });
  }
};

// ==============================
// 🔐 AUTH
// ==============================
export const loginApi = (data: any) =>
  handle(api.post("/login", data));

// ==============================
// 📊 DASHBOARD
// ==============================
export const getRegions = () =>
  handle(api.get("/regions"));

export const createRegion = (data: {
  organization_id: number;
  name: string;
  description: string;
  geometry: string;
  region_area: number;
}) => handle(api.post("/regions", data));

// ==============================
// 🌱 SOIL
// ==============================
export const getSoilSummary = () =>
  handle(api.get("/soil-summary"));

// ==============================
// 🌿 CROP
// ==============================
export const getCropSummary = () =>
  handle(api.get("/crop-summary"));

// ==============================
// 🗺️ MAP
// ==============================
export const getMap = (params: any) =>
  handle(api.get("/map", { params }));

// ==============================
// 📄 RECOMMENDATIONS
// ==============================
export const getRecommendations = () =>
  handle(api.get("/recommendations"));

export const createRecommendation = (data: any) =>
  handle(api.post("/recommendations", data));

// ==============================
// 🛠️ ADMIN - ORGANIZATION
// ==============================
export const getOrganizations = () =>
  handle(api.get("/organizations"));

export const createOrganization = (data: any) =>
  handle(api.post("/organizations", data));

export const deactivateOrganization = (id: number) =>
  handle(api.patch(`/organizations/${id}/deactivate`));

export const activateUser = (id: number) =>
  handle(api.patch(`/users/${id}/activate`));
// ==============================
// 🛠️ ADMIN - USERS
// ==============================
export const getUsers = () =>
  handle(api.get("/users"));

export const createUser = (data: any) =>
  handle(api.post("/users", data));

export const deactivateUser = (id: number) =>
  handle(api.patch(`/users/${id}/deactivate`));

// ==============================
// 🌾 ADMIN - REGION
// ==============================
export interface RegionImportPayload {
  region_id: number | string;
  name?: string;
  /** Base64 KML content consumed by the region-import Lambda. */
  file: string;
  file_name?: string;
  /** Base64 Excel content consumed by the region-import Lambda. */
  crop_data_file?: string;
  crop_data_file_name?: string;
  crop_data_content_type?: string;
  monitoring?: Record<string, unknown>;
  crop_cycle?: Record<string, unknown>;
}

/**
 * Sends an existing region ID and its KML to API Gateway. The Lambda behind
 * this route is responsible for updating that region's database records.
 */
export const updateRegionFromImport = (data: RegionImportPayload) =>
  handle(api.post("/region/upload", data));

// Kept for compatibility with existing callers.
export const uploadRegion = updateRegionFromImport;

export const getRegionsByOrg = (organization_id: number) =>
  handle(api.get(`/regions?organization_id=${organization_id}`));

export const disableMonitoring = (farm_id: number) =>
  handle(api.patch(`/region/${farm_id}/disable-monitoring`));

// ==============================
// 📊 ADMIN DASHBOARD
// ==============================
export const getAdminDashboard = () =>
  handle(api.get("/admin/dashboard"));

export default api;
