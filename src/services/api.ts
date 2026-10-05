import axios from "axios";

const api = axios.create({
  baseURL:
    "https://171oyca6o7.execute-api.ap-south-1.amazonaws.com",
  timeout: 30000,
});

// ============================================================
// AUTH TOKEN
// ============================================================

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// ============================================================
// RESPONSE
// ============================================================

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = "/";
    }

    return Promise.reject(error);
  }
);

// ============================================================
// HANDLE API GATEWAY RESPONSE
// ============================================================

const handle = async (promise: Promise<any>) => {
  try {
    const response = await promise;

    let data = response.data;

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
        // leave as string
      }
    }

    return data;
  } catch (error: any) {
    console.error("API ERROR:", error);

    let message =
      error?.response?.data?.details ||
      error?.response?.data?.error ||
      error?.response?.data?.message ||
      error?.message ||
      "Something went wrong";

    const rawBody =
      error?.response?.data?.body;

    if (rawBody) {
      try {
        const parsed =
          typeof rawBody === "string"
            ? JSON.parse(rawBody)
            : rawBody;

        message =
          parsed?.details ||
          parsed?.error ||
          parsed?.message ||
          message;
      } catch {
        // ignore
      }
    }

    throw new Error(message);
  }
};

// ============================================================
// LOGIN
// ============================================================

export const loginApi = (data: any) =>
  handle(api.post("/login", data));

// ============================================================
// DASHBOARD
// ============================================================

export const getSoilSummary = () =>
  handle(api.get("/soil-summary"));

export const getCropSummary = () =>
  handle(api.get("/crop-summary"));

export const getMap = (params: any) =>
  handle(
    api.get("/map", {
      params,
    })
  );

export const getAdminDashboard = () =>
  handle(api.get("/admin/dashboard"));

// ============================================================
// RECOMMENDATIONS
// ============================================================

export const getRecommendations = () =>
  handle(api.get("/recommendations"));

export const createRecommendation = (
  data: any
) =>
  handle(
    api.post("/recommendations", data)
  );

// ============================================================
// ORGANIZATIONS
// ============================================================

export const getOrganizations = () =>
  handle(api.get("/organizations"));

export const createOrganization = (
  data: any
) =>
  handle(
    api.post("/organizations", data)
  );

export const deactivateOrganization = (
  id: number
) =>
  handle(
    api.patch(
      `/organizations/${id}/deactivate`
    )
  );

// ============================================================
// USERS
// ============================================================

export const getUsers = () =>
  handle(api.get("/users"));

export const createUser = (data: any) =>
  handle(api.post("/users", data));

export const deactivateUser = (
  id: number
) =>
  handle(
    api.patch(
      `/users/${id}/deactivate`
    )
  );

export const activateUser = (
  id: number
) =>
  handle(
    api.patch(
      `/users/${id}/activate`
    )
  );

// ============================================================
// GET REGIONS
// Existing GET Regions Lambda
// ============================================================

export const getRegions = () =>
  handle(api.get("/regions"));

export const getRegionsByOrg = (
  organizationId: number
) =>
  handle(
    api.get("/regions", {
      params: {
        organization_id:
          organizationId,
      },
    })
  );

// ============================================================
// CREATE REGION - NEW FLOW
// POST /s1/regions
// ============================================================

export interface CreateRegionDetailsPayload {
  organization_id: number;
  country: string;
  state: string;
  name: string;
  description?: string;
}

export const createRegionDetails = (
  data: CreateRegionDetailsPayload
) =>
  handle(
    api.post("/s1/regions", data)
  );

// ============================================================
// OLD CREATE REGION API
// KEEP FOR OTHER EXISTING CODE
// ============================================================

export interface CreateRegionPayload {
  organization_id: number;
  name: string;
  description: string;
  region_area: number;
  kml_file_name: string;
  kml_file_content: string;
}

export const createRegion = (
  data: CreateRegionPayload
) =>
  handle(
    api.post("/region/upload", data)
  );

// ============================================================
// CREATE FIELDS / UPLOAD KML
// POST /s1/region/upload
// ============================================================

export interface UploadRegionFieldsPayload {
  region_id: number | string;
  kml_file_name: string;
  kml_file_content: string;
}

export const uploadRegionFields = (
  data: UploadRegionFieldsPayload
) =>
  handle(
    api.post(
      "/s1/region/upload",
      data
    )
  );

// ============================================================
// OLD REGION IMPORT
// KEEP EXISTING EXPORTS
// ============================================================

export interface RegionImportPayload {
  region_id: number | string;
  name?: string;

  file_content: string;
  file_name?: string;

  crop_data_file?: string;
  crop_data_file_name?: string;
  crop_data_content_type?: string;

  monitoring?: Record<
    string,
    unknown
  >;

  crop_cycle?: Record<
    string,
    unknown
  >;
}

export const updateRegionFromImport = (
  data: RegionImportPayload
) =>
  handle(
    api.post("/region/upload", data)
  );

export const uploadRegion =
  updateRegionFromImport;

// ============================================================
// UPLOAD CROP EXCEL
// POST /s1/region/crops/upload
// ============================================================

export const uploadCropDetailsExcel =
  async (
    regionId: number | string,
    payload: any
  ) => {
    const body = {
      region_id: Number(
        payload.region_id ||
          regionId
      ),

      file_name:
        payload.file_name ||
        payload.crop_data_file_name,

      file_content:
        payload.file_content ||
        payload.crop_data_file,
    };

    return handle(
      api.post(
        "/s1/region/crops/upload",
        body
      )
    );
  };

// ============================================================
// MAP CROP TO FIELD
// POST /s1/region/crops/map
// ============================================================

export interface MapCropToFieldPayload {
  region_id: number | string;
  crop_id: number | string;
  temp_field_id: string;
}

export const mapCropToField = (
  data: MapCropToFieldPayload
) =>
  handle(
    api.post(
      "/s1/region/crops/map",
      {
        region_id: Number(
          data.region_id
        ),

        crop_id: Number(
          data.crop_id
        ),

        temp_field_id:
          data.temp_field_id,
      }
    )
  );

// ============================================================
// EXISTING REGION MAPPING
// KEEP THIS FOR OTHER EXISTING PAGE
// ============================================================

export const saveRegionMappings =
  async (
    regionId:
      | number
      | string,

    payload:
      Record<
        string,
        unknown
      >
  ) => {
    const attempts = [
      () =>
        handle(
          api.patch(
            `/region/${regionId}/mapping`,
            payload
          )
        ),

      () =>
        handle(
          api.put(
            `/region/${regionId}/mapping`,
            payload
          )
        ),

      () =>
        handle(
          api.patch(
            `/regions/${regionId}/mapping`,
            payload
          )
        ),

      () =>
        handle(
          api.post(
            `/region/${regionId}/mapping`,
            payload
          )
        ),
    ];

    let lastError: unknown;

    for (const attempt of attempts) {
      try {
        return await attempt();
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  };

// ============================================================
// DISABLE MONITORING
// ============================================================

export const disableMonitoring = (
  farmId: number
) =>
  handle(
    api.patch(
      `/region/${farmId}/disable-monitoring`
    )
  );

export default api;