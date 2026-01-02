import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import Divider from "@mui/material/Divider";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import HomeIcon from "@mui/icons-material/Home";
import EngineeringIcon from "@mui/icons-material/Engineering";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import Collapse from "@mui/material/Collapse";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import WysiwygIcon from "@mui/icons-material/Wysiwyg";
import WifiIcon from "@mui/icons-material/Wifi";
import HandymanIcon from "@mui/icons-material/Handyman";
import BuildIcon from "@mui/icons-material/Build";

const drawerWidth = 280;

const ICONS = {
  "/dashboard": <DashboardIcon />,
  "/users": <PeopleIcon />,
  "/employees": <EngineeringIcon />,
  "/assets": <DesktopWindowsIcon />,
  "/software": <WysiwygIcon />,
  "/internet": <WifiIcon />,
  "/assignments": <AssignmentIndIcon />,
  "/repairs": <HandymanIcon />,
  "/maintenance": <BuildIcon />,
  "/": <HomeIcon />,
};

export default function Sidebar({ navItems, open, setOpen, disabled = false }) {
  const location = useLocation();
  const [openGroups, setOpenGroups] = React.useState({});

  // ✅ auto-open parent if a child route is active
  React.useEffect(() => {
    const next = {};
    navItems.forEach((item) => {
      if (item.children) {
        next[item.label] = item.children.some(
          (c) => c.to === location.pathname
        );
      }
    });
    setOpenGroups((prev) => ({ ...prev, ...next }));
  }, [location.pathname, navItems]);

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={() => setOpen(false)}
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        sx: {
          width: drawerWidth,
          borderRight: "1px solid rgb(226 232 240)",
          boxShadow: "2px 0 12px rgba(0,0,0,0.05)",
        },
      }}
    >
      <Box
        sx={{
          width: drawerWidth,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          bgcolor: "#f8fafc",
        }}
      >
        {/* Header */}
        <div className="px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700">
              <DashboardIcon sx={{ color: "#fff", fontSize: 20 }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">ITMS</h2>
              <p className="text-xs text-slate-500">IT Management System</p>
            </div>
          </div>
        </div>

        <Divider sx={{ borderColor: "rgb(226 232 240)" }} />

        {/* Menu */}
        <List sx={{ p: 2, flex: 1 }}>
          {navItems.map((item) => {
            // ===== GROUP =====
            if (item.children) {
              const isOpen = openGroups[item.label] ?? false;

              return (
                <Box key={item.label} sx={{ mb: 1 }}>
                  <ListItemButton
                    onClick={() =>
                      setOpenGroups((p) => ({
                        ...p,
                        [item.label]: !isOpen,
                      }))
                    }
                    sx={{
                      px: 2.5,
                      py: 1,
                      borderRadius: 2,
                      "&:hover": { bgcolor: "rgb(241 245 249)" },
                    }}
                  >
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: "rgb(100 116 139)",
                      }}
                    />
                    <ExpandMoreIcon
                      sx={{
                        fontSize: 18,
                        color: "rgb(100 116 139)",
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "0.2s",
                      }}
                    />
                  </ListItemButton>

                  <Collapse in={isOpen} timeout="auto" unmountOnExit>
                    {item.children.map((child) => {
                      const active = location.pathname === child.to;

                      return (
                        <ListItem
                          key={child.to}
                          disablePadding
                          sx={{ mb: 0.5 }}
                        >
                          <ListItemButton
                            component={NavLink}
                            to={child.to}
                            disabled={disabled}
                            selected={active}
                            onClick={() => setOpen(false)}
                            sx={{
                              px: 2.5,
                              py: 1.5,
                              ml: 2,
                              borderRadius: 2,
                              "&.Mui-selected": {
                                bgcolor: "rgb(15 23 42)",
                                color: "#fff",
                                "&:hover": {
                                  bgcolor: "rgb(17 25 47)",
                                },
                              },
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 38, mr: 1 }}>
                              <div
                                className={`p-1.5 rounded-lg ${
                                  active ? "bg-white/20" : "bg-slate-100"
                                }`}
                              >
                                {ICONS[child.to]}
                              </div>
                            </ListItemIcon>
                            <ListItemText
                              primary={child.label}
                              primaryTypographyProps={{
                                fontSize: 14,
                                fontWeight: active ? 600 : 500,
                              }}
                            />
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </Collapse>
                </Box>
              );
            }

            // ===== SINGLE ITEM =====
            const active = location.pathname === item.to;

            return (
              <ListItem key={item.to} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  component={NavLink}
                  to={item.to}
                  disabled={disabled}
                  selected={active}
                  onClick={() => setOpen(false)}
                  sx={{
                    px: 2.5,
                    py: 1.5,
                    borderRadius: 2,
                    "&.Mui-selected": {
                      bgcolor: "rgb(15 23 42)",
                      color: "#fff",
                      "&:hover": {
                        bgcolor: "rgb(17 25 47)",
                      },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 38, mr: 1 }}>
                    <div
                      className={`p-1.5 rounded-lg ${
                        active ? "bg-white/20" : "bg-slate-100"
                      }`}
                    >
                      {ICONS[item.to]}
                    </div>
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: 14,
                      fontWeight: active ? 600 : 500,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200">
          <p className="text-xs text-slate-500 text-center">
            © {new Date().getFullYear()} ITMS
          </p>
        </div>
      </Box>
    </Drawer>
  );
}
