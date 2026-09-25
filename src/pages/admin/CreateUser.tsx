import { useEffect, useState } from "react";
import {
  Box,
  TextField,
  Button,
  Select,
  MenuItem,
  Typography,
  Alert,
  FormControl,
  InputLabel
} from "@mui/material";

import { getOrganizations, createUser } from "../../services/api";

export default function CreateUser() {

  const [orgs, setOrgs] = useState<any[]>([]);

  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "user",
    organization_id: ""
  });

  const [alert, setAlert] = useState<{ type: "success" | "error" | ""; text: string }>({
    type: "",
    text: ""
  });

  // =========================
  const showError = (msg: string) => {
    setAlert({ type: "error", text: msg });
  };

  const showSuccess = (msg: string) => {
    setAlert({ type: "success", text: msg });
  };

  const clearAlert = () => {
    setAlert({ type: "", text: "" });
  };

  // =========================
  useEffect(() => {
    getOrganizations()
      .then(setOrgs)
      .catch(() => showError("Failed to load organizations"));
  }, []);

  // =========================
  const handleSubmit = async () => {
    try {
      clearAlert();

      if (!form.username || !form.password || !form.organization_id) {
        showError("All fields are required");
        return;
      }

      await createUser({
        username: form.username,
        password: form.password,
        role: form.role,
        organization_id: Number(form.organization_id)
      });

      showSuccess("User created successfully");

      setForm({
        username: "",
        password: "",
        role: "user",
        organization_id: ""
      });

    } catch (e: any) {
      showError(e?.message || "Failed to create user");
    }
  };

  // =========================
  return (
    <Box maxWidth={500} mx="auto">

      <Typography variant="h5" mb={3}>
        👤 Create User
      </Typography>

      {alert.text && (
        <Alert
          severity={alert.type === "success" ? "success" : "error"}
          sx={{ mb: 2 }}
        >
          {alert.text}
        </Alert>
      )}

      <TextField
        label="Username"
        fullWidth
        sx={{ mb: 2 }}
        value={form.username}
        onChange={(e) => setForm({ ...form, username: e.target.value })}
      />

      <TextField
        label="Password"
        type="password"
        fullWidth
        sx={{ mb: 2 }}
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Organization</InputLabel>
        <Select
          value={form.organization_id}
          label="Organization"
          onChange={(e) =>
            setForm({ ...form, organization_id: e.target.value })
          }
        >
          {orgs.map((o) => (
            <MenuItem key={o.id} value={o.id}>
              {o.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Role</InputLabel>
        <Select
          value={form.role}
          label="Role"
          onChange={(e) =>
            setForm({ ...form, role: e.target.value })
          }
        >
          <MenuItem value="user">User</MenuItem>
          <MenuItem value="scientist">Scientist</MenuItem>
          <MenuItem value="admin">Admin</MenuItem>
        </Select>
      </FormControl>

      <Button variant="contained" fullWidth onClick={handleSubmit}>
        Create User
      </Button>

    </Box>
  );
}