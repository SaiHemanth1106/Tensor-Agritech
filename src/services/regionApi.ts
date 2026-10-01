import axios from "axios";

const BASE_URL =
  "https://171oyca6o7.execute-api.ap-south-1.amazonaws.com";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// ============================================================
// AUTH TOKEN
// ============================================================

api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem(
        "token"
      );

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  },

  (error) =>
    Promise.reject(error)
);

// ============================================================
// RESPONSE
// ============================================================

api.interceptors.response.use(
  (response) => response,

  (error) => {
    console.error(
      "API ERROR:",
      error
    );

    if (
      error.response?.status ===
      401
    ) {
      localStorage.clear();

      window.location.href =
        "/";
    }

    return Promise.reject(
      error
    );
  }
);

// ============================================================
// UNWRAP LAMBDA RESPONSE
// ============================================================

const unwrap = (
  input: any
) => {
  let data = input;

  if (
    data &&
    typeof data === "object" &&
    "body" in data
  ) {
    data =
      typeof data.body ===
      "string"
        ? JSON.parse(
            data.body
          )
        : data.body;
  }

  if (
    typeof data ===
    "string"
  ) {
    try {
      data =
        JSON.parse(data);
    } catch {
      // keep original
    }
  }

  return data;
};

// ============================================================
// ERROR MESSAGE
// ============================================================

const getErrorMessage = (
  error: any
) => {
  const responseData =
    unwrap(
      error?.response?.data
    );

  return (
    responseData?.details ||
    responseData?.error ||
    responseData?.message ||
    error?.message ||
    "Request failed."
  );
};

// ============================================================
// ORGANIZATIONS
// ============================================================

export const getOrganizations =
  async () => {
    try {
      const response =
        await api.get(
          "/organizations"
        );

      return unwrap(
        response.data
      );
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error
        )
      );
    }
  };

// ============================================================
// REGIONS
// ============================================================

export const getRegions =
  async () => {
    try {
      const response =
        await api.get(
          "/regions"
        );

      return unwrap(
        response.data
      );
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error
        )
      );
    }
  };

// ============================================================
// CREATE REGION
// ============================================================

export const createRegion =
  async (data: {
    organization_id: number;

    country: string;

    state: string;

    name: string;

    description: string;
  }) => {
    try {
      const response =
        await api.post(
          "/regions",
          data
        );

      return unwrap(
        response.data
      );
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error
        )
      );
    }
  };

// ============================================================
// UPLOAD REGION KML
// ============================================================

export const uploadRegionKml =
  async (data: {
    region_id:
      string | number;

    kml_file_name:
      string;

    kml_file_content:
      string;
  }) => {
    try {
      const response =
        await api.post(
          "/region/upload",
          data
        );

      return unwrap(
        response.data
      );
    } catch (error) {
      throw new Error(
        getErrorMessage(
          error
        )
      );
    }
  };

// ============================================================
// UPLOAD CROP DETAILS
//
// IMPORTANT:
// Existing Priya branch API uses:
// POST /s1/region/crops/upload
// ============================================================

export const uploadCropDetailsExcel =
  async (
    regionId:
      string | number,

    payload: {
      region_id?:
        string | number;

      file_name?:
        string;

      file_content?:
        string;

      crop_data_file_name?:
        string;

      crop_data_file?:
        string;
    }
  ) => {
    const body = {
      region_id:
        Number(
          payload.region_id ??
            regionId
        ),

      file_name:
        payload.file_name ||
        payload.crop_data_file_name,

      file_content:
        payload.file_content ||
        payload.crop_data_file,
    };

    if (
      !body.region_id ||
      Number.isNaN(
        body.region_id
      )
    ) {
      throw new Error(
        "Invalid region ID."
      );
    }

    if (!body.file_name) {
      throw new Error(
        "Excel file name is missing."
      );
    }

    if (
      !body.file_content
    ) {
      throw new Error(
        "Excel file content is missing."
      );
    }

    try {
      const response =
        await api.post(
          "/s1/region/crops/upload",
          body
        );

      return unwrap(
        response.data
      );
    } catch (error) {
      console.error(
        "UPLOAD CROP DETAILS ERROR:",
        error
      );

      throw new Error(
        getErrorMessage(
          error
        )
      );
    }
  };

export default api;