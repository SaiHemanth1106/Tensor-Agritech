import {
  useEffect,
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
  Paper,
  TextField,
  Typography,
} from "@mui/material";

import * as toGeoJSON from "@tmcw/togeojson";

import {
  uploadRegionFields,
} from "../../services/api";

interface CreateFieldsProps {
  onGoToCropDetails: (
    regionId: number | string,
    regionName: string
  ) => void;
}

interface CreatedRegion {
  regionId: string;
  organizationId: string;
  country: string;
  state: string;
  regionName: string;
}

interface BackendField {
  geometry_reference_id?:
    | number
    | string;

  temp_field_id?: string;

  field_index?: number;

  field_name?: string;

  geometry?: any;
}

const fileToBase64 = (
  file: File
): Promise<string> =>
  new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        if (
          typeof reader.result !==
          "string"
        ) {
          reject(
            new Error(
              "Unable to read KML."
            )
          );
          return;
        }

        const value =
          reader.result.includes(
            ","
          )
            ? reader.result.split(
                ","
              )[1]
            : reader.result;

        resolve(value);
      };

      reader.onerror =
        () =>
          reject(
            new Error(
              "Unable to read KML."
            )
          );

      reader.readAsDataURL(
        file
      );
    }
  );

const parseGeometry = (
  value: any
) => {
  if (
    typeof value ===
    "string"
  ) {
    try {
      return JSON.parse(
        value
      );
    } catch {
      return value;
    }
  }

  return value;
};

export default function CreateFields({
  onGoToCropDetails,
}: CreateFieldsProps) {
  const [
    region,
    setRegion,
  ] = useState<
    CreatedRegion | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    kmlBase64,
    setKmlBase64,
  ] = useState("");

  const [
    kmlFileName,
    setKmlFileName,
  ] = useState("");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    successOpen,
    setSuccessOpen,
  ] = useState(false);

  const [
    createdFieldCount,
    setCreatedFieldCount,
  ] = useState(0);

  // ==========================================================
  // LOCAL STORAGE ONLY
  // NO API FETCH
  // ==========================================================

  useEffect(() => {
    const stored =
      localStorage.getItem(
        "lastCreatedRegion"
      );

    if (!stored) {
      setError(
        "No recently created region found. Create a region first."
      );

      setLoading(false);
      return;
    }

    try {
      const parsed =
        JSON.parse(
          stored
        );

      if (
        !parsed?.regionId
      ) {
        throw new Error(
          "Region ID missing."
        );
      }

      setRegion({
        regionId:
          String(
            parsed.regionId
          ),

        organizationId:
          String(
            parsed.organizationId ??
              ""
          ),

        country:
          String(
            parsed.country ??
              ""
          ),

        state:
          String(
            parsed.state ??
              ""
          ),

        regionName:
          String(
            parsed.regionName ??
              ""
          ),
      });
    } catch {
      setError(
        "Unable to read created region."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleKml =
    async (
      event:
        ChangeEvent<HTMLInputElement>
    ) => {
      const file =
        event.target
          .files?.[0];

      if (!file) {
        return;
      }

      setError("");

      if (
        !file.name
          .toLowerCase()
          .endsWith(
            ".kml"
          )
      ) {
        setError(
          "Please select a valid .kml file."
        );

        event.target.value =
          "";
        return;
      }

      try {
        const text =
          await file.text();

        const xml =
          new DOMParser()
            .parseFromString(
              text,
              "text/xml"
            );

        if (
          xml.querySelector(
            "parsererror"
          )
        ) {
          throw new Error(
            "Invalid KML file."
          );
        }

        const geojson =
          toGeoJSON.kml(
            xml
          );

        if (
          !geojson.features ||
          geojson.features
            .length === 0
        ) {
          throw new Error(
            "No fields found in KML."
          );
        }

        const base64 =
          await fileToBase64(
            file
          );

        setKmlBase64(
          base64
        );

        setKmlFileName(
          file.name
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to process KML."
        );
      }
    };

  const handleCreateFields =
    async () => {
      if (!region) {
        setError(
          "Region details are missing."
        );
        return;
      }

      if (
        !kmlBase64 ||
        !kmlFileName
      ) {
        setError(
          "Please upload a KML file."
        );
        return;
      }

      try {
        setSubmitting(true);
        setError("");

        const response =
          await uploadRegionFields(
            {
              region_id:
                Number(
                  region.regionId
                ),

              kml_file_name:
                kmlFileName,

              kml_file_content:
                kmlBase64,
            }
          );

        if (
          response?.success ===
          false
        ) {
          throw new Error(
            response?.details ||
              response?.error ||
              response?.message ||
              "Field creation failed."
          );
        }

        const fields:
          BackendField[] =
          response?.fields
            ?.items ?? [];

        if (
          fields.length ===
          0
        ) {
          throw new Error(
            "Backend did not return temporary fields."
          );
        }

        const geometry =
          {
            type:
              "FeatureCollection",

            features:
              fields.map(
                (
                  field,
                  index
                ) => ({
                  type:
                    "Feature",

                  properties: {
                    temp_field_id:
                      field.temp_field_id,

                    geometry_reference_id:
                      field.geometry_reference_id,

                    field_index:
                      field.field_index ??
                      index +
                        1,

                    field_name:
                      field.field_name ||
                      `Field ${
                        index +
                        1
                      }`,
                  },

                  geometry:
                    parseGeometry(
                      field.geometry
                    ),
                })
              ),
          };

        localStorage.setItem(
          `regionGeometry:${region.regionId}`,
          JSON.stringify(
            geometry
          )
        );

        localStorage.setItem(
          "pendingCropRegion",
          JSON.stringify({
            regionId:
              region.regionId,

            regionName:
              region.regionName,
          })
        );

        setCreatedFieldCount(
          response?.fields
            ?.count ??
            fields.length
        );

        setSuccessOpen(
          true
        );
      } catch (err) {
        console.error(
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Failed to create fields."
        );
      } finally {
        setSubmitting(false);
      }
    };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        py={6}
      >
        <CircularProgress />
      </Box>
    );
  }

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
            sx={{ mb: 3 }}
          >
            🌱 Create Fields
          </Typography>

          {error && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
            >
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Organisation ID"
            value={
              region
                ?.organizationId ??
              ""
            }
            InputProps={{
              readOnly: true,
            }}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Country"
            value={
              region?.country ??
              ""
            }
            InputProps={{
              readOnly: true,
            }}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="State"
            value={
              region?.state ??
              ""
            }
            InputProps={{
              readOnly: true,
            }}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Region Name"
            value={
              region
                ?.regionName ??
              ""
            }
            InputProps={{
              readOnly: true,
            }}
            sx={{ mb: 3 }}
          />

          <Button
            component="label"
            fullWidth
            variant="outlined"
            sx={{
              height: 48,
              mb: 1,
            }}
          >
            UPLOAD KML

            <input
              hidden
              type="file"
              accept=".kml"
              onChange={
                handleKml
              }
            />
          </Button>

          {kmlFileName && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: 3 }}
            >
              Selected file:{" "}
              <strong>
                {kmlFileName}
              </strong>
            </Typography>
          )}

          <Button
            fullWidth
            variant="contained"
            onClick={
              handleCreateFields
            }
            disabled={
              submitting ||
              !region ||
              !kmlBase64
            }
            sx={{
              minHeight: 46,
            }}
          >
            {submitting ? (
              <>
                <CircularProgress
                  size={20}
                  color="inherit"
                  sx={{ mr: 1 }}
                />

                CREATING...
              </>
            ) : (
              "CREATE FIELDS"
            )}
          </Button>
        </Paper>
      </Box>

      <Dialog
        open={
          successOpen
        }
        onClose={() =>
          setSuccessOpen(
            false
          )
        }
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Fields Created
        </DialogTitle>

        <DialogContent>
          <Alert
            severity="success"
            sx={{ mt: 1 }}
          >
            Upload Region Lambda triggered successfully.
            {" "}
            KML processed successfully.
            {" "}
            {createdFieldCount} field(s) created.
          </Alert>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() =>
              setSuccessOpen(
                false
              )
            }
          >
            CLOSE
          </Button>

          <Button
            variant="contained"
            onClick={() => {
              if (!region) {
                return;
              }

              setSuccessOpen(
                false
              );

              onGoToCropDetails(
                region.regionId,
                region.regionName
              );
            }}
          >
            UPLOAD CROP DETAILS
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}