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
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================================
// RESPONSE
// ============================================================

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
// UNWRAP LAMBDA RESPONSE
// ============================================================

const unwrap = (input: any) => {
  let data = input;

  // API Gateway / Lambda response
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

  // Stringified JSON
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      // Keep original value
    }
  }

  return data;
};

// ============================================================
// ERROR MESSAGE
// ============================================================

const getErrorMessage = (error: any) => {
  const responseData = unwrap(
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

export const getOrganizations = async () => {
  try {
    const response = await api.get(
      "/organizations"
    );

    return unwrap(response.data);
  } catch (error) {
    throw new Error(
      getErrorMessage(error)
    );
  }
};

// ============================================================
// REGIONS
// ============================================================

export const getRegions = async () => {
  try {
    const response = await api.get(
      "/regions"
    );

    return unwrap(response.data);
  } catch (error) {
    throw new Error(
      getErrorMessage(error)
    );
  }
};

// ============================================================
// CREATE REGION
// ============================================================

export const createRegion = async (data: {
  organization_id: number;
  country: string;
  state: string;
  name: string;
  description: string;
}) => {
  try {
    const response = await api.post(
      "/regions",
      data
    );

    return unwrap(response.data);
  } catch (error) {
    throw new Error(
      getErrorMessage(error)
    );
  }
};

// ============================================================
// UPLOAD REGION KML
// ============================================================

export const uploadRegionKml = async (data: {
  region_id: string | number;
  kml_file_name: string;
  kml_file_content: string;
}) => {
  try {
    const response = await api.post(
      "/region/upload",
      data
    );

    return unwrap(response.data);
  } catch (error) {
    throw new Error(
      getErrorMessage(error)
    );
  }
};

// ============================================================
// UPLOAD CROP DETAILS EXCEL
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
    region_id: Number(
      payload.region_id ?? regionId
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
    Number.isNaN(body.region_id)
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

  if (!body.file_content) {
    throw new Error(
      "Excel file content is missing."
    );
  }

  try {
    const response = await api.post(
      "/s1/region/crops/upload",
      body
    );

    return unwrap(response.data);
  } catch (error) {
    console.error(
      "UPLOAD CROP DETAILS ERROR:",
      error
    );

    throw new Error(
      getErrorMessage(error)
    );
  }
};

// ============================================================
// CROP MAPPING TYPES
// ============================================================

export interface CropMappingStatusResponse {
  success: boolean;

  region_id: number;

  total: number;

  mapped_count: number;

  pending_count: number;

  completed: boolean;

  crops: CropMappingCrop[];

  geometries: CropMappingGeometry[];
}

export interface CropMappingCrop {
  crop_id: string;

  field_id: string | null;

  crop_name?: string | null;

  crop_type?: string | null;

  season?: string | null;

  sowing_date?: string | null;

  expected_harvest_date?: string | null;

  previous_harvest_date?: string | null;

  area?: number | null;

  seed_quantity?: number | null;

  expected_yield?: number | null;

  previous_yield?: number | null;

  description?: string | null;

  is_active?: boolean | null;

  farmer_name?: string | null;

  mapping_status:
    | "Mapped"
    | "Pending";
}

export interface CropMappingGeometry {
  geometry_reference_id: string;

  temp_field_id: string;

  geometry: {
    type: string;

    coordinates: any;
  };

  country?: string | null;

  state?: string | null;
}

// ============================================================
// GET CROP MAPPING STATUS
//
// Lambda:
// GET /region/crop-mapping?region_id=7
//
// Returns:
// - crops
// - mapped_count
// - pending_count
// - geometries
// ============================================================

export const getCropMappingStatus = async (
  regionId: string | number
): Promise<CropMappingStatusResponse> => {
  const id = String(regionId);

  if (!id) {
    throw new Error(
      "Region ID is required."
    );
  }

  try {
    const response = await api.get(
      "/region/crop-mapping",
      {
        params: {
          region_id: id,
        },
      }
    );

    const data = unwrap(
      response.data
    );

    return data as CropMappingStatusResponse;
  } catch (error) {
    console.error(
      "GET CROP MAPPING STATUS ERROR:",
      error
    );

    throw new Error(
      getErrorMessage(error)
    );
  }
};

// ============================================================
// MAP CROP TO FIELD
//
// IMPORTANT:
// crop_id is intentionally STRING.
// Your crop IDs are BIGINT values such as:
// 12493978461495344
//
// JavaScript Number can lose precision for these values.
// ============================================================

export const mapCropToField = async (data: {
  region_id: string | number;

  crop_id: string | number;

  temp_field_id: string;
}) => {
  const body = {
    action: "map",

    region_id: Number(
      data.region_id
    ),

    crop_id: String(
      data.crop_id
    ),

    temp_field_id:
      data.temp_field_id,
  };

  if (
    !body.region_id ||
    Number.isNaN(body.region_id)
  ) {
    throw new Error(
      "Invalid region ID."
    );
  }

  if (!body.crop_id) {
    throw new Error(
      "Crop ID is required."
    );
  }

  if (!body.temp_field_id) {
    throw new Error(
      "Temporary field ID is required."
    );
  }

  try {
    const response = await api.post(
      "/region/crop-mapping",
      body
    );

    return unwrap(
      response.data
    );
  } catch (error) {
    console.error(
      "MAP CROP TO FIELD ERROR:",
      error
    );

    throw new Error(
      getErrorMessage(error)
    );
  }
};

// ============================================================
// COMPLETE CROP MAPPING
//
// Only succeeds when:
// pending_count === 0
//
// Backend then removes temporary crop records.
// Geometry records are retained.
// ============================================================

export const completeCropMapping = async (
  regionId: string | number
) => {
  const body = {
    action: "complete",

    region_id: Number(
      regionId
    ),
  };

  if (
    !body.region_id ||
    Number.isNaN(body.region_id)
  ) {
    throw new Error(
      "Invalid region ID."
    );
  }

  try {
    const response = await api.post(
      "/region/crop-mapping",
      body
    );

    return unwrap(
      response.data
    );
  } catch (error) {
    console.error(
      "COMPLETE CROP MAPPING ERROR:",
      error
    );

    throw new Error(
      getErrorMessage(error)
    );
  }
};

// ============================================================
// DEFAULT API
// ============================================================

export default api;