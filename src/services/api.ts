
import axios from "axios";

const BASE_URL =
  "https://171oyca6o7.execute-api.ap-south-1.amazonaws.com";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// ============================================================
// AUTHENTICATION
// ============================================================

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

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

// ============================================================
// RESPONSE HELPERS
// ============================================================

export const unwrap = (input: any): any => {
  let data = input;

  if (
    data &&
    typeof data === "object" &&
    "body" in data
  ) {
    data =
      typeof data.body === "string"
        ? JSON.parse(data.body)
        : data.body;
  }

  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      // Keep a non-JSON string unchanged.
    }
  }

  return data;
};

export const getErrorMessage = (error: any): string => {
  let responseData: any;

  try {
    responseData = unwrap(error?.response?.data);
  } catch {
    responseData = error?.response?.data;
  }

  return (
    responseData?.details ||
    responseData?.error ||
    responseData?.message ||
    error?.message ||
    "Request failed."
  );
};

// ============================================================
// AUTH
// ============================================================

export const loginApi = async (data: any) => {
  try {
    const response = await api.post("/login", data);
    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// ============================================================
// ORGANIZATIONS
// ============================================================

export const getOrganizations = async () => {
  try {
    const response = await api.get("/organizations");
    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const createOrganization = async (data: any) => {
  try {
    const response = await api.post("/organizations", data);
    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const deactivateOrganization = async (id: number) => {
  try {
    const response = await api.patch(
      `/organizations/${id}/deactivate`
    );
    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// ============================================================
// DASHBOARD REGIONS
// Keep GET /regions unchanged for dashboard visualization.
// ============================================================

export const getRegions = async () => {
  try {
    const response = await api.get("/regions");
    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// ============================================================
// CREATE FIELD: ORGANIZATION-SCOPED REGIONS
// Uses the separate GET /region-field endpoint.
// ============================================================

export interface FieldRegionQuery {
  organization_id: number;
  country?: string;
  state?: string;
}

export const getFieldRegions = async (
  params: FieldRegionQuery
) => {
  try {
    const response = await api.get("/region-field", {
      params,
    });

    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// ============================================================
// CREATE REGION
// ============================================================

export interface CreateRegionPayload {
  organization_id: number;
  country: string;
  state: string;
  name: string;
  description: string;
}

export const createRegion = async (
  data: CreateRegionPayload
) => {
  try {
    const response = await api.post("/regions", data);
    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// ============================================================
// REGION KML UPLOAD
// ============================================================

export interface RegionKmlPayload {
  region_id: string | number;
  kml_file_name: string;
  kml_file_content: string;
}

export const uploadRegionKml = async (
  data: RegionKmlPayload
) => {
  try {
    const response = await api.post("/region/upload", data);
    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// ============================================================
// USER MANAGEMENT
// ============================================================

export const getUsers = async () => {
  try {
    const response = await api.get("/users");
    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const createUser = async (data: any) => {
  try {
    const response = await api.post("/users", data);
    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const deactivateUser = async (id: number) => {
  try {
    const response = await api.patch(`/users/${id}/deactivate`);
    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const activateUser = async (id: number) => {
  try {
    const response = await api.patch(`/users/${id}/activate`);
    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// ============================================================
// CROP DETAILS EXCEL UPLOAD
// ============================================================

export const uploadCropDetailsExcel = async (
  regionId: string | number,
  payload: {
    region_id?: string | number;
    file_name?: string;
    file_content?: string;
    crop_data_file_name?: string;
    crop_data_file?: string;
  }
) => {
  const body = {
    region_id: Number(payload.region_id ?? regionId),
    file_name:
      payload.file_name || payload.crop_data_file_name,
    file_content:
      payload.file_content || payload.crop_data_file,
  };

  if (
    !body.region_id ||
    Number.isNaN(body.region_id)
  ) {
    throw new Error("Invalid region ID.");
  }

  if (!body.file_name) {
    throw new Error("Excel file name is missing.");
  }

  if (!body.file_content) {
    throw new Error("Excel file content is missing.");
  }

  try {
    const response = await api.post(
      "/s1/region/crops/upload",
      body
    );

    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// ============================================================
// MONITORING
// ============================================================

export const disableMonitoring = async (farmId: number) => {
  try {
    const response = await api.patch(
      `/region/${farmId}/disable-monitoring`
    );
    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// ============================================================
// ADMIN DASHBOARD
// ============================================================

export const getAdminDashboard = async () => {
  try {
    const response = await api.get("/admin/dashboard");
    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// ============================================================
// OTHER DASHBOARD ENDPOINTS
// ============================================================

export const getSoilSummary = async () => {
  try {
    const response = await api.get("/soil-summary");
    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const getCropSummary = async () => {
  try {
    const response = await api.get("/crop-summary");
    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const getMap = async (params: any) => {
  try {
    const response = await api.get("/map", { params });
    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const getRecommendations = async () => {
  try {
    const response = await api.get("/recommendations");
    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const createRecommendation = async (data: any) => {
  try {
    const response = await api.post("/recommendations", data);
    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const saveRegionMappings = async (
  regionId: string | number,
  payload: Record<string, unknown>
) => {
  if (
    regionId === "" ||
    regionId === null ||
    regionId === undefined ||
    Number.isNaN(Number(regionId))
  ) {
    throw new Error("Invalid region ID.");
  }

  try {
    const response = await api.post("/region/crops/map", {
      ...payload,
      region_id: Number(regionId),
    });

    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default api;
