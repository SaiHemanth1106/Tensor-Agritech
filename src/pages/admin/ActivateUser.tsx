import { useEffect, useState } from "react";

import {
  Box,
  Select,
  MenuItem,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  Paper
} from "@mui/material";

import {
  getUsers,
  activateUser
} from "../../services/api";

export default function ActivateUser() {

  const [users, setUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [openDialog, setOpenDialog] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ==============================
  // LOAD USERS
  // ==============================
  const loadUsers = async () => {

    try {

      setLoadingUsers(true);
      setError("");

      const data = await getUsers();

      console.log("Users:", data);

      if (Array.isArray(data)) {

        // Only inactive users
        const inactiveUsers = data.filter(
          (user: any) => user.is_active === false
        );

        setUsers(inactiveUsers);

      } else {

        console.error("Invalid users response:", data);
        setUsers([]);

        setError("Unable to load users");

      }

    } catch (err: any) {

      console.error("Load users error:", err);

      setError(
        err?.message ||
        err?.error ||
        "Failed to load users"
      );

    } finally {

      setLoadingUsers(false);

    }
  };

  // ==============================
  // INITIAL LOAD
  // ==============================
  useEffect(() => {
    loadUsers();
  }, []);

  // ==============================
  // OPEN CONFIRMATION
  // ==============================
  const handleActivateClick = () => {

    setError("");
    setMessage("");

    if (!selected) {
      setError("Please select a user");
      return;
    }

    setOpenDialog(true);
  };

  // ==============================
  // CONFIRM ACTIVATION
  // ==============================
  const handleConfirmActivate = async () => {

    try {

      setLoading(true);
      setError("");
      setMessage("");

      await activateUser(Number(selected));

      setMessage("User activated successfully");

      setOpenDialog(false);

      // Remove activated user from dropdown
      setUsers((prev) =>
        prev.filter(
          (user) => String(user.id) !== String(selected)
        )
      );

      setSelected("");

    } catch (err: any) {

      console.error("Activate user error:", err);

      setError(
        err?.message ||
        err?.error ||
        "Failed to activate user"
      );

      setOpenDialog(false);

    } finally {

      setLoading(false);

    }
  };

  // ==============================
  // CANCEL
  // ==============================
  const handleCancel = () => {
    if (!loading) {
      setOpenDialog(false);
    }
  };

  // ==============================
  // UI
  // ==============================
  return (
    <Box maxWidth={600} mx="auto">

      <Paper
        elevation={3}
        sx={{
          p: 4,
          borderRadius: 3
        }}
      >

        <Typography
          variant="h5"
          fontWeight="bold"
          mb={3}
        >
          👤 Activate User
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          mb={2}
        >
          Select an inactive user to restore access to the
          application.
        </Typography>

        {/* ==============================
            USER DROPDOWN
        ============================== */}

        {loadingUsers ? (

          <Box
            display="flex"
            justifyContent="center"
            py={3}
          >
            <CircularProgress />
          </Box>

        ) : (

          <Select
            fullWidth
            displayEmpty
            value={selected}
            onChange={(e) =>
              setSelected(e.target.value)
            }
          >

            <MenuItem value="">
              <em>Select inactive user</em>
            </MenuItem>

            {users.map((user) => (

              <MenuItem
                key={user.id}
                value={user.id}
              >
                {user.username}
                {user.role
                  ? ` (${user.role})`
                  : ""}
              </MenuItem>

            ))}

          </Select>

        )}

        {/* NO USERS */}

        {!loadingUsers && users.length === 0 && (

          <Typography
            variant="body2"
            color="text.secondary"
            mt={2}
          >
            No inactive users are available for activation.
          </Typography>

        )}

        {/* ERROR */}

        {error && (

          <Typography
            color="error"
            mt={2}
          >
            {error}
          </Typography>

        )}

        {/* SUCCESS */}

        {message && (

          <Typography
            color="success.main"
            mt={2}
          >
            {message}
          </Typography>

        )}

        {/* ACTIVATE BUTTON */}

        <Button
          fullWidth
          variant="contained"
          sx={{
            mt: 3,
            bgcolor: "#2D6A4F",
            "&:hover": {
              bgcolor: "#1B4332"
            }
          }}
          disabled={
            loadingUsers ||
            loading ||
            !selected
          }
          onClick={handleActivateClick}
        >

          {loading
            ? <CircularProgress
                size={24}
                color="inherit"
              />
            : "Activate User"}

        </Button>

      </Paper>

      {/* ==============================
          CONFIRMATION DIALOG
      ============================== */}

      <Dialog
        open={openDialog}
        onClose={handleCancel}
      >

        <DialogTitle>
          Confirm User Activation
        </DialogTitle>

        <DialogContent>

          <DialogContentText>
            Are you sure you want to activate this user?
            The user will regain access to the application.
          </DialogContentText>

        </DialogContent>

        <DialogActions>

          <Button
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </Button>

          <Button
            onClick={handleConfirmActivate}
            variant="contained"
            color="success"
            disabled={loading}
          >
            {loading
              ? <CircularProgress
                  size={20}
                  color="inherit"
                />
              : "Confirm"}
          </Button>

        </DialogActions>

      </Dialog>

    </Box>
  );
}