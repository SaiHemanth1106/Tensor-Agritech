import { Box, TextField, Button, Typography, Card, CardContent, CircularProgress } from "@mui/material";
import { useState } from "react";
import { loginApi } from "../services/api";

export default function Login({ setUser }: any) {

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    console.log("LOGIN CLICKED");

    try {
      setError("");
      setLoading(true);

      const resRaw = await loginApi({ username, password });

      console.log("RAW RESPONSE:", resRaw);

      // =========================
      // ✅ HANDLE LAMBDA RESPONSE FORMAT
      // =========================
      let res = resRaw;

      if (resRaw?.body) {
        res = typeof resRaw.body === "string"
          ? JSON.parse(resRaw.body)
          : resRaw.body;
      }

      console.log("PARSED RESPONSE:", res);

      if (!res?.token) {
        throw new Error("Invalid response from server (missing token)");
      }

      // 🔐 Store token
      localStorage.setItem("token", res.token);

      // =========================
      // ✅ NORMALIZE USER OBJECT
      // =========================
      let userData = res.user || res;

      // 🔑 Force admin role
      if (username === "UZ-MASUI-ADMIN") {
        userData = {
          ...userData,
          role: "admin"
        };
      }

      console.log("FINAL USER:", userData);

      // 🔐 Store user
      localStorage.setItem("user", JSON.stringify(userData));

      // ✅ Trigger App routing
      setUser(userData);

    } catch (e: any) {
      console.error("LOGIN ERROR:", e);
      setError(e?.message || "Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      bgcolor="#f4f6f8"
    >

      <Card sx={{ width: 350, p: 2, borderRadius: 3, boxShadow: 3 }}>
        <CardContent>

          {/* LOGO */}
          <Box textAlign="center" mb={2}>
            <img
              src="/logo.png"
              alt="Tensor AgriTech"
              style={{ width: "140px", marginBottom: "10px" }}
            />
          </Box>

          {/* SUBTITLE */}
          <Typography
            variant="subtitle1"
            textAlign="center"
            mb={2}
            sx={{ color: "#555" }}
          >
            Agri Geo Intelligence Platform
          </Typography>

          {/* USERNAME */}
          <TextField
            fullWidth
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            sx={{ mb: 2 }}
          />

          {/* PASSWORD */}
          <TextField
            fullWidth
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ mb: 2 }}
          />

          {/* LOGIN BUTTON */}
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={login}
            disabled={loading}
            sx={{
              bgcolor: "#2D6A4F",
              "&:hover": { bgcolor: "#1B4332" }
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : "Login"}
          </Button>

          {/* ERROR */}
          {error && (
            <Typography color="error" mt={2} textAlign="center">
              {error}
            </Typography>
          )}

          {/* FOOTER */}
          <Typography
            variant="caption"
            display="block"
            textAlign="center"
            mt={3}
            sx={{ color: "#777" }}
          >
            © 2026 Tensor AgriTech Pvt. Ltd.
          </Typography>

        </CardContent>
      </Card>

    </Box>
  );
}