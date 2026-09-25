// src/components/Navbar.tsx
import { AppBar, Toolbar, Typography, Button } from "@mui/material";

export default function Navbar({ logout }: any) {
  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          🌱 Agri Geo Platform
        </Typography>

        <Button color="inherit" onClick={logout}>
          Logout
        </Button>
      </Toolbar>
    </AppBar>
  );
}