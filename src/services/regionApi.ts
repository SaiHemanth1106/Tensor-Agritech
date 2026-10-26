import api, {
  unwrap,
  getErrorMessage,
} from "./api";

// ============================================================
// TYPES
// ============================================================

export interface FieldRegionQuery {
  /**
   * Optional for an authorized global administrator.
   * The backend must enforce the user's permissions.
   */
  organization_id?: number;
  country?: string;
  state?: string;
}

export interface Region {
  id?: number | string;
  region_id?: number | string;
  regionId?: number | string;
  organization_id?: number | string;
  organizationId?: number | string;
  name?: string;
  region_name?: string;
  regionName?: string;
  country?: string;
  state?: string;
  description?: string;
  area?: number | string | null;
  is_active?: boolean;
  geometries?: unknown[];
  geometry?: unknown;
  kml_url?: string;
  [key: string]: unknown;
}

export interface RegionKmlPayload {
  region_id: number | string;
  kml_file_name: string;
  kml_file_content: string;
}

export interface RegionImportPayload {
  region_id: number | string;
  name?: string;
  file_content: string;
  file_name?: string;
  crop_data_file?: string;
  crop_data_file_name?: string;
  crop_data_content_type?: string;
  monitoring?: Record<string, unknown>;
  crop_cycle?: Record<string, unknown>;
}

export interface CropExcelUploadPayload {
  region_id?: number | string;
  file_name?: string;
  file_content?: string;
  crop_data_file_name?: string;
  crop_data_file?: string;
}

export interface CreateRegionPayload {
  organization_id: number;
  country: string;
  state: string;
  name: string;
  description: string;
}

// ============================================================
// RESPONSE NORMALIZATION
// ============================================================

/**
 * Supports APIs returning:
 *   [...]
 *   { regions: [...] }
 *   { data: [...] }
 *   { success: true, data: { regions: [...] } }
 */
export const getRegionList = (response: unknown): Region[] => {
  if (Array.isArray(response)) {
    return response as Region[];
  }

  if (!response || typeof response !== "object") {
    return [];
  }

  const result = response as Record<string, unknown>;

  if (Array.isArray(result.regions)) {
    return result.regions as Region[];
  }

  if (Array.isArray(result.data)) {
    return result.data as Region[];
  }

  if (
    result.data &&
    typeof result.data === "object"
  ) {
    const nested = result.data as Record<string, unknown>;

    if (Array.isArray(nested.regions)) {
      return nested.regions as Region[];
    }
  }

  return [];
};

// ============================================================
// ORGANIZATIONS
// ============================================================

export const getOrganizations = async (): Promise<unknown> => {
  try {
    const response = await api.get("/organizations");
    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// ============================================================
// CREATE REGION
// ============================================================

export const createRegion = async (
  payload: CreateRegionPayload
): Promise<unknown> => {
  try {
    const response = await api.post("/regions", payload);
    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// ============================================================
// DASHBOARD REGIONS
// GET /regions
//
// Keep this endpoint for existing dashboard functionality.
// ============================================================

export const getRegions = async (): Promise<unknown> => {
  try {
    const response = await api.get("/regions");
    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// ============================================================
// REGION LIST FOR UPLOAD CROP DETAILS AND VIEW REGIONS
// GET /region-field
//
// Country, State and Region dropdowns should use this list.
//
// Global administrator:
//   getFieldRegions()
//
// Organization-scoped user:
//   getFieldRegions({ organization_id: 4 })
//
// Optional filters:
//   getFieldRegions({
//     country: "India",
//     state: "Andhra Pradesh",
//   })
//
// SECURITY:
// The backend must authenticate the request and enforce
// organization access. Omitting organization_id does not
// independently authorize global access.
// ============================================================

export const getFieldRegions = async (
  params: FieldRegionQuery = {}
): Promise<unknown> => {
  try {
    const queryParams: Record<string, string | number> = {};

    if (params.organization_id != null) {
      queryParams.organization_id = params.organization_id;
    }

    if (params.country?.trim()) {
      queryParams.country = params.country.trim();
    }

    if (params.state?.trim()) {
      queryParams.state = params.state.trim();
    }

    const response = await api.get("/region-field", {
      params: queryParams,
    });

    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// ============================================================
// COMPATIBILITY ALIAS
// ============================================================

export const getRegionsByOrg = async (
  organizationId: number
): Promise<unknown> => {
  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    throw new Error("A valid organization ID is required.");
  }

  return getFieldRegions({
    organization_id: organizationId,
  });
};

// ============================================================
// UPLOAD KML FOR AN EXISTING REGION
// POST /region/upload
//
// Geometry uploads remain in Create Field, not in the
// Upload Crop Details page.
// ============================================================

export const uploadRegionKml = async (
  data: RegionKmlPayload
): Promise<unknown> => {
  try {
    const response = await api.post("/region/upload", data);
    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// ============================================================
// REGION IMPORT COMPATIBILITY
// POST /region/upload
// ============================================================

export const updateRegionFromImport = async (
  data: RegionImportPayload
): Promise<unknown> => {
  try {
    const response = await api.post("/region/upload", data);
    return unwrap(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const uploadRegion = updateRegionFromImport;

// ============================================================
// UPLOAD CROP DETAILS EXCEL
// POST /s1/region/crops/upload
//
// Uploads crop details only.
// Does not upload KML or create field geometries.
// ============================================================

export const uploadCropDetailsExcel = async (
  regionId: number | string,
  payload: CropExcelUploadPayload
): Promise<any> => {
  const resolvedRegionId = Number(
    payload.region_id ?? regionId
  );

  const fileName = (
    payload.file_name ??
    payload.crop_data_file_name ??
    ""
  ).trim();

  const fileContent =
    payload.file_content ??
    payload.crop_data_file ??
    "";

  if (
    !Number.isSafeInteger(resolvedRegionId) ||
    resolvedRegionId <= 0
  ) {
    throw new Error("Please select a valid region.");
  }

  if (!fileName) {
    throw new Error("Excel file name is missing.");
  }

  if (!fileName.toLowerCase().endsWith(".xlsx")) {
    throw new Error("Only .xlsx Excel files are supported.");
  }

  if (
    typeof fileContent !== "string" ||
    !fileContent.trim()
  ) {
    throw new Error("Excel file content is missing.");
  }

  const body = {
    region_id: resolvedRegionId,
    file_name: fileName,
    file_content: fileContent,
  };

  try {
    const response = await api.post(
      "/s1/region/crops/upload",
      body
    );

    const result = unwrap(response.data);

    if (
      result &&
      typeof result === "object" &&
      "success" in result &&
      result.success === false
    ) {
      const message =
        "details" in result && typeof result.details === "string"
          ? result.details
          : "error" in result && typeof result.error === "string"
            ? result.error
            : "Excel upload failed.";

      throw new Error(message);
    }

    return result;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// ============================================================
// DISABLE MONITORING
// PATCH /region/:id/disable-monitoring
// ============================================================

export const disableMonitoring = async (
  farmId: number
): Promise<unknown> => {
  if (!Number.isSafeInteger(farmId) || farmId <= 0) {
    throw new Error("A valid region ID is required.");
  }

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
// REGION MAPPING
//
// Preserves the existing route fallbacks.
// ============================================================

export const saveRegionMappings = async (
  regionId: number | string,
  payload: Record<string, unknown>
): Promise<unknown> => {
  const numericRegionId = Number(regionId);

  if (
    !Number.isSafeInteger(numericRegionId) ||
    numericRegionId <= 0
  ) {
    throw new Error("A valid region ID is required.");
  }

  const attempts = [
    () =>
      api.patch(
        `/region/${numericRegionId}/mapping`,
        payload
      ),
    () =>
      api.put(
        `/region/${numericRegionId}/mapping`,
        payload
      ),
    () =>
      api.patch(
        `/regions/${numericRegionId}/mapping`,
        payload
      ),
    () =>
      api.put(
        `/regions/${numericRegionId}/mapping`,
        payload
      ),
    () =>
      api.patch(
        `/region/${numericRegionId}/fields`,
        payload
      ),
    () =>
      api.patch(
        `/regions/${numericRegionId}/fields`,
        payload
      ),
    () =>
      api.post(
        `/region/${numericRegionId}/mapping`,
        payload
      ),
  ];

  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      const response = await attempt();
      return unwrap(response.data);
    } catch (error: any) {
      lastError = error;

      // Do not try alternate routes when authentication or
      // authorization fails. Those errors need to be fixed
      // at the authentication/backend layer.
      const status = error?.response?.status;

      if (status === 401 || status === 403) {
        break;
      }

      // For other errors, retain the existing fallback behavior.
    }
  }

  throw new Error(getErrorMessage(lastError));
};
