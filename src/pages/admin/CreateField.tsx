import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  ChangeEvent,
} from "react";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from "@mui/material";

import {
  getRegions,
  uploadRegionKml,
} from "../../services/regionApi";

type Region = Record<string, any>;

interface CreateFieldProps {
  onGoToCropDetails?: (
    regionId: string,
    regionName: string
  ) => void;

  onNavigate?: (
    page: string
  ) => void;
}

interface StoredRegion {
  regionId: string;
  organizationId: string;
  country: string;
  state: string;
  regionName: string;
  description?: string;
}

const getRegionList = (
  response: any
): Region[] => {
  if (Array.isArray(response)) {
    return response;
  }

  if (
    response &&
    Array.isArray(response.regions)
  ) {
    return response.regions;
  }

  if (
    response &&
    Array.isArray(response.data)
  ) {
    return response.data;
  }

  return [];
};

const getRegionId = (
  region: Region
) =>
  String(
    region?.region_id ??
      region?.id ??
      region?.regionId ??
      ""
  );

const getRegionName = (
  region: Region
) =>
  String(
    region?.name ??
      region?.region_name ??
      region?.regionName ??
      ""
  );

const getOrganizationId = (
  region: Region
) =>
  String(
    region?.organization_id ??
      region?.organizationId ??
      region?.org_id ??
      ""
  );

const getCountry = (
  region: Region
) =>
  String(
    region?.country ??
      region?.region_country ??
      ""
  );

const getState = (
  region: Region
) =>
  String(
    region?.state ??
      region?.region_state ??
      ""
  );

const readLastCreatedRegion =
  (): StoredRegion | null => {
    try {
      const value =
        localStorage.getItem(
          "lastCreatedRegion"
        );

      if (!value) {
        return null;
      }

      const parsed =
        JSON.parse(value);

      if (!parsed?.regionId) {
        return null;
      }

      return {
        regionId: String(
          parsed.regionId
        ),

        organizationId: String(
          parsed.organizationId ??
            ""
        ),

        country: String(
          parsed.country ?? ""
        ),

        state: String(
          parsed.state ?? ""
        ),

        regionName: String(
          parsed.regionName ?? ""
        ),

        description: String(
          parsed.description ?? ""
        ),
      };
    } catch {
      return null;
    }
  };

const fileToBase64 = (
  file: File
): Promise<string> =>
  new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        const result =
          reader.result;

        if (
          typeof result !==
          "string"
        ) {
          reject(
            new Error(
              "Unable to read KML file."
            )
          );

          return;
        }

        const base64 =
          result.includes(",")
            ? result.split(",")[1]
            : result;

        if (!base64) {
          reject(
            new Error(
              "Invalid KML file."
            )
          );

          return;
        }

        resolve(base64);
      };

      reader.onerror = () =>
        reject(
          new Error(
            "Unable to read KML file."
          )
        );

      reader.readAsDataURL(
        file
      );
    }
  );

export default function CreateField({
  onGoToCropDetails,
  onNavigate,
}: CreateFieldProps) {
  const [
    regions,
    setRegions,
  ] = useState<Region[]>([]);

  const [
    selectedRegionId,
    setSelectedRegionId,
  ] = useState("");

  const [
    kmlFile,
    setKmlFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    storedRegion,
    setStoredRegion,
  ] =
    useState<StoredRegion | null>(
      null
    );

  const [
    completionOpen,
    setCompletionOpen,
  ] = useState(false);

  const [
    lambdaStatus,
    setLambdaStatus,
  ] = useState<
    "success" | "error"
  >("success");

  const [
    lambdaDetail,
    setLambdaDetail,
  ] = useState("");

  const [
    createdFieldCount,
    setCreatedFieldCount,
  ] = useState(0);

  useEffect(() => {
    const loadRegions =
      async () => {
        try {
          setLoading(true);
          setError("");

          const lastRegion =
            readLastCreatedRegion();

          setStoredRegion(
            lastRegion
          );

          const response =
            await getRegions();

          const apiRegions =
            getRegionList(
              response
            );

          let nextRegions =
            [...apiRegions];

          if (lastRegion) {
            const exists =
              nextRegions.some(
                (region) =>
                  getRegionId(
                    region
                  ) ===
                  lastRegion.regionId
              );

            if (!exists) {
              nextRegions = [
                {
                  id:
                    lastRegion.regionId,

                  region_id:
                    lastRegion.regionId,

                  organization_id:
                    lastRegion.organizationId,

                  country:
                    lastRegion.country,

                  state:
                    lastRegion.state,

                  name:
                    lastRegion.regionName,

                  description:
                    lastRegion.description,
                },

                ...nextRegions,
              ];
            }
          }

          setRegions(
            nextRegions
          );

          if (
            lastRegion?.regionId
          ) {
            setSelectedRegionId(
              lastRegion.regionId
            );
          } else if (
            nextRegions.length > 0
          ) {
            setSelectedRegionId(
              getRegionId(
                nextRegions[0]
              )
            );
          }
        } catch (err) {
          const lastRegion =
            readLastCreatedRegion();

          if (lastRegion) {
            setStoredRegion(
              lastRegion
            );

            setRegions([
              {
                id:
                  lastRegion.regionId,

                region_id:
                  lastRegion.regionId,

                organization_id:
                  lastRegion.organizationId,

                country:
                  lastRegion.country,

                state:
                  lastRegion.state,

                name:
                  lastRegion.regionName,
              },
            ]);

            setSelectedRegionId(
              lastRegion.regionId
            );
          } else {
            setError(
              err instanceof Error
                ? err.message
                : "Failed to load regions."
            );
          }
        } finally {
          setLoading(false);
        }
      };

    void loadRegions();
  }, []);

  const selectedRegion =
    useMemo(
      () =>
        regions.find(
          (region) =>
            getRegionId(
              region
            ) ===
            selectedRegionId
        ) ?? null,
      [
        regions,
        selectedRegionId,
      ]
    );

  const regionName =
    useMemo(() => {
      const value =
        selectedRegion
          ? getRegionName(
              selectedRegion
            )
          : "";

      if (value) {
        return value;
      }

      if (
        storedRegion &&
        storedRegion.regionId ===
          selectedRegionId
      ) {
        return storedRegion.regionName;
      }

      return "";
    }, [
      selectedRegion,
      selectedRegionId,
      storedRegion,
    ]);

  const organizationId =
    useMemo(() => {
      const value =
        selectedRegion
          ? getOrganizationId(
              selectedRegion
            )
          : "";

      if (value) {
        return value;
      }

      if (
        storedRegion &&
        storedRegion.regionId ===
          selectedRegionId
      ) {
        return storedRegion.organizationId;
      }

      return "";
    }, [
      selectedRegion,
      selectedRegionId,
      storedRegion,
    ]);

  const country =
    useMemo(() => {
      const value =
        selectedRegion
          ? getCountry(
              selectedRegion
            )
          : "";

      if (value) {
        return value;
      }

      if (
        storedRegion &&
        storedRegion.regionId ===
          selectedRegionId
      ) {
        return storedRegion.country;
      }

      return "";
    }, [
      selectedRegion,
      selectedRegionId,
      storedRegion,
    ]);

  const state =
    useMemo(() => {
      const value =
        selectedRegion
          ? getState(
              selectedRegion
            )
          : "";

      if (value) {
        return value;
      }

      if (
        storedRegion &&
        storedRegion.regionId ===
          selectedRegionId
      ) {
        return storedRegion.state;
      }

      return "";
    }, [
      selectedRegion,
      selectedRegionId,
      storedRegion,
    ]);

  const handleFile = (
    event:
      ChangeEvent<HTMLInputElement>
  ) => {
    setError("");
    setSuccess("");

    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      !file.name
        .toLowerCase()
        .endsWith(".kml")
    ) {
      setKmlFile(null);

      setError(
        "Please upload a valid .kml file."
      );

      event.target.value =
        "";

      return;
    }

    setKmlFile(file);

    setSuccess(
      "KML file selected successfully."
    );
  };

  const handleSubmit =
    async () => {
      setError("");
      setSuccess("");

      if (!selectedRegionId) {
        setError(
          "Please select a region."
        );

        return;
      }

      if (
        !organizationId ||
        !country ||
        !state
      ) {
        setError(
          "Region details are incomplete."
        );

        return;
      }

      if (!kmlFile) {
        setError(
          "Please upload a KML file."
        );

        return;
      }

      try {
        setSubmitting(true);

        const base64 =
          await fileToBase64(
            kmlFile
          );

        const result =
          await uploadRegionKml({
            region_id:
              selectedRegionId,

            kml_file_name:
              kmlFile.name,

            kml_file_content:
              base64,
          });

        if (
          result?.success ===
          false
        ) {
          throw new Error(
            result?.error ||
              result?.message ||
              "UploadRegion Lambda failed."
          );
        }

        const fields =
          result?.fields?.items ??
          [];

        const count =
          result?.fields?.count ??
          fields.length;

        const geoJson = {
          type:
            "FeatureCollection",

          features:
            fields.map(
              (
                field: any,
                index: number
              ) => ({
                type:
                  "Feature",

                geometry:
                  field.geometry,

                properties: {
                  geometry_reference_id:
                    field.geometry_reference_id,

                  temp_field_id:
                    field.temp_field_id,

                  field_index:
                    field.field_index ??
                    index + 1,

                  field_name:
                    field.field_name ??
                    `Field ${
                      index + 1
                    }`,

                  region_id:
                    selectedRegionId,

                  organization_id:
                    organizationId,

                  country,

                  state,
                },
              })
            ),
        };

        localStorage.setItem(
          `regionGeometry:${selectedRegionId}`,

          JSON.stringify(
            geoJson
          )
        );

        localStorage.setItem(
          "pendingCropRegion",

          JSON.stringify({
            regionId:
              selectedRegionId,

            regionName,

            organizationId,

            country,

            state,
          })
        );

        setCreatedFieldCount(
          count
        );

        setLambdaStatus(
          "success"
        );

        setLambdaDetail(
          result?.message ||
            "KML processed successfully."
        );

        setSuccess(
          `${count} field polygon(s) created successfully.`
        );

        setKmlFile(null);

        // FIRST SHOW POPUP
        setCompletionOpen(
          true
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "UploadRegion Lambda failed.";

        setError(message);

        setLambdaStatus(
          "error"
        );

        setLambdaDetail(
          message
        );

        // FAILURE ALSO SHOWS POPUP
        setCompletionOpen(
          true
        );
      } finally {
        setSubmitting(false);
      }
    };

  const handleUploadCropDetails =
    () => {
      setCompletionOpen(
        false
      );

      if (
        onGoToCropDetails
      ) {
        onGoToCropDetails(
          selectedRegionId,
          regionName
        );

        return;
      }

      if (onNavigate) {
        onNavigate(
          "region-upload-crop-details"
        );

        return;
      }

      setSuccess(
        "Open Upload Crop Details from the sidebar."
      );
    };

  return (
    <>
      <Box
        maxWidth={650}
        mx="auto"
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            borderRadius: 3,
          }}
        >
          <Typography
            variant="h5"
            fontWeight="bold"
            mb={1}
          >
            🗺️ Create Field
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            mb={3}
          >
            Select a region.
            Organisation ID,
            Country and State are
            filled automatically.
          </Typography>

          {error && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
            >
              {error}
            </Alert>
          )}

          {success && (
            <Alert
              severity="success"
              sx={{ mb: 2 }}
            >
              {success}
            </Alert>
          )}

          <FormControl
            fullWidth
            required
            sx={{ mb: 2 }}
            disabled={
              loading ||
              submitting
            }
          >
            <InputLabel>
              Region
            </InputLabel>

            <Select
              value={
                selectedRegionId
              }
              label="Region"
              onChange={(
                event
              ) => {
                setSelectedRegionId(
                  String(
                    event.target
                      .value
                  )
                );

                setKmlFile(
                  null
                );

                setError("");
                setSuccess("");
              }}
            >
              {regions.map(
                (region) => {
                  const id =
                    getRegionId(
                      region
                    );

                  return (
                    <MenuItem
                      key={id}
                      value={id}
                    >
                      {id} —{" "}
                      {getRegionName(
                        region
                      )}
                    </MenuItem>
                  );
                }
              )}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Organisation ID"
            value={
              organizationId
            }
            disabled
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Country"
            value={country}
            disabled
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="State"
            value={state}
            disabled
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Region Name"
            value={regionName}
            disabled
            sx={{ mb: 3 }}
          />

          <Button
            component="label"
            variant="outlined"
            fullWidth
            disabled={
              submitting ||
              !selectedRegionId
            }
            sx={{
              minHeight: 45,
              mb: 1,
            }}
          >
            UPLOAD KML

            <input
              hidden
              type="file"
              accept=".kml,application/vnd.google-earth.kml+xml"
              onChange={
                handleFile
              }
            />
          </Button>

          {kmlFile ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 1,
                mb: 3,
              }}
            >
              Selected file:{" "}
              {kmlFile.name}
            </Typography>
          ) : (
            <Box mb={3} />
          )}

          <Button
            fullWidth
            variant="contained"
            onClick={
              handleSubmit
            }
            disabled={
              submitting ||
              !selectedRegionId ||
              !kmlFile
            }
            sx={{
              minHeight: 45,

              backgroundColor:
                "#075d16",

              "&:hover": {
                backgroundColor:
                  "#064d12",
              },
            }}
          >
            {submitting ? (
              <>
                <CircularProgress
                  size={21}
                  color="inherit"
                  sx={{ mr: 1 }}
                />

                TRIGGERING
                LAMBDA...
              </>
            ) : (
              "CREATE FIELD"
            )}
          </Button>
        </Paper>
      </Box>

      {/* ==================================================== */}
      {/* LAMBDA RESULT POPUP */}
      {/* ==================================================== */}

      <Dialog
        open={
          completionOpen
        }
        onClose={() =>
          setCompletionOpen(
            false
          )
        }
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {lambdaStatus ===
          "success"
            ? "Field Process Completed"
            : "Field Process Failed"}
        </DialogTitle>

        <DialogContent>
          <Alert
            severity={
              lambdaStatus ===
              "success"
                ? "success"
                : "error"
            }
            sx={{ mt: 1 }}
          >
            <Typography
              fontWeight="bold"
              mb={1}
            >
              UploadRegion
              Lambda:{" "}
              {lambdaStatus}
            </Typography>

            <Typography
              variant="body2"
              mb={1}
            >
              {lambdaDetail}
            </Typography>

            {lambdaStatus ===
              "success" && (
              <>
                <Typography
                  variant="body2"
                >
                  Region:{" "}
                  {regionName}
                </Typography>

                <Typography
                  variant="body2"
                >
                  Region ID:{" "}
                  {
                    selectedRegionId
                  }
                </Typography>

                <Typography
                  variant="body2"
                >
                  Field polygons:{" "}
                  {
                    createdFieldCount
                  }
                </Typography>
              </>
            )}
          </Alert>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() =>
              setCompletionOpen(
                false
              )
            }
          >
            CLOSE
          </Button>

          {lambdaStatus ===
            "success" && (
            <Button
              variant="contained"
              onClick={
                handleUploadCropDetails
              }
              sx={{
                backgroundColor:
                  "#075d16",

                "&:hover": {
                  backgroundColor:
                    "#064d12",
                },
              }}
            >
              UPLOAD CROP
              DETAILS
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}