import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";

import { getUsers, deactivateUser } from "../../services/api";

export default function DeactivateUser() {

  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [alert, setAlert] = useState("");

  const [selectedRole, setSelectedRole] = useState("all");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // =========================
  const fetchUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
      setFilteredUsers(data);
    } catch (e: any) {
      setAlert(e.message);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // =========================
  // Role Filter Logic
  useEffect(() => {
    if (selectedRole === "all") {
      setFilteredUsers(users);
    } else {
      setFilteredUsers(users.filter(u => u.role === selectedRole));
    }
  }, [selectedRole, users]);

  // =========================
  const openConfirm = (id: number) => {
    setSelectedUserId(id);
    setConfirmOpen(true);
  };

  const handleDeactivate = async () => {
    try {
      if (!selectedUserId) return;

      setAlert("");

      await deactivateUser(selectedUserId);

      // 🔥 instant UI update
      setUsers(prev =>
        prev.map(u =>
          u.id === selectedUserId ? { ...u, is_active: false } : u
        )
      );

      setAlert("User deactivated successfully");

    } catch (e: any) {
      setAlert(e.message);
    } finally {
      setConfirmOpen(false);
      setSelectedUserId(null);
    }
  };

  // =========================
  const columns = [
    { field: "id", headerName: "ID", width: 80 },
    { field: "username", headerName: "Username", width: 150 },
    { field: "role", headerName: "Role", width: 120 },
    { field: "organization", headerName: "Organization", width: 180 },
    {
      field: "status",
      headerName: "Status",
      width: 120,
      renderCell: (params: any) =>
        params.row.is_active ? "Active" : "Inactive"
    },
    {
      field: "action",
      headerName: "Action",
      width: 180,
      renderCell: (params: any) => (
        <Button
          variant="contained"
          color="error"
          disabled={!params.row.is_active}
          onClick={() => openConfirm(params.row.id)}
        >
          Deactivate
        </Button>
      )
    }
  ];

  // =========================
  return (
    <Box>

      <Typography variant="h5" mb={2}>
        🚫 Deactivate Users
      </Typography>

      {alert && <Alert severity="info" sx={{ mb: 2 }}>{alert}</Alert>}

      {/* 🔹 Role Filter */}
      <FormControl sx={{ mb: 2, minWidth: 200 }}>
        <InputLabel>Filter by Role</InputLabel>
        <Select
          value={selectedRole}
          label="Filter by Role"
          onChange={(e) => setSelectedRole(e.target.value)}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="admin">Admin</MenuItem>
          <MenuItem value="scientist">Scientist</MenuItem>
          <MenuItem value="user">User</MenuItem>
        </Select>
      </FormControl>

      {/* 🔹 Data Grid */}
      <Box height={420}>
        <DataGrid
          rows={filteredUsers}
          columns={columns}
          getRowId={(row) => row.id}
        />
      </Box>

      {/* 🔥 Confirmation Dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirm Deactivation</DialogTitle>

        <DialogContent>
          Are you sure you want to deactivate this user?
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>

          <Button color="error" onClick={handleDeactivate}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}