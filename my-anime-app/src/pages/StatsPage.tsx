// src/pages/StatsPage.tsx
import { useState, useEffect } from "react";
import api from "../api";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
} from "@mui/material";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// --- Interfaces ---
interface TypeStats {
  total_completed: number;
}
interface StatsData {
  overall: TypeStats;
  by_type: {
    [key: string]: TypeStats;
  };
  time_spent_hours: {
    [key: string]: number;
  };
}

// --- Color mapping for media types ---
const COLORS: Record<string, string> = {
  ANIME: "#FF9800", // orange
  MOVIE: "#4CAF50", // green
  TV_SHOW: "#2196F3", // blue
  GAME: "#9C27B0", // purple
  BOOK: "#795548", // brown
  OVERALL: "#FF5722", // deep orange
};

// --- StatCard Component (for by-type cards) ---
const StatCard = ({
  title,
  stats,
  time_spent,
}: {
  title: string;
  stats: TypeStats;
  time_spent: number;
}) => (
  <Card
    sx={{
      height: "100%",
      bgcolor: "background.paper",
      borderRadius: 2,
      boxShadow: 3,
    }}
  >
    <CardContent>
      <Typography variant="h6" sx={{ fontWeight: "bold", mb: 1 }}>
        {title}
      </Typography>
      <Typography sx={{ mb: 1.5 }} color="text.secondary">
        Total Completed: {stats.total_completed}
      </Typography>
      <Divider sx={{ my: 1 }} />
      <Typography variant="body1" gutterBottom>
        Estimated Time Spent:
      </Typography>
      <Typography variant="h4" sx={{ color: "orange", fontWeight: "bold" }}>
        ≈ {Math.round(time_spent)} hours
      </Typography>
    </CardContent>
  </Card>
);

// --- StatsPage ---
function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get("/api/stats/");
        setStats(response.data);
      } catch (err) {
        console.error("Failed to fetch stats", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <CircularProgress />;
  if (!stats)
    return (
      <Typography>
        Could not load stats. Complete some items to see them here!
      </Typography>
    );

  // --- Prepare chart data for donut ---
  const chartData = Object.entries(stats.time_spent_hours)
    .filter(([type]) => type !== "OVERALL") // exclude overall
    .map(([type, hours]) => ({
      name: type.replace("_", " "),
      value: Math.round(hours),
      color: COLORS[type] || "#9E9E9E",
    }));

  return (
    <Box>
      <Typography
        variant="h4"
        gutterBottom
        sx={{ fontWeight: "bold", color: "primary.main", mb: 3 }}
      >
        Your Statistics
      </Typography>

      {/* --- Overall Card with Donut Chart --- */}
      <Card
        sx={{
          mb: 4,
          p: 2,
          bgcolor: "background.paper",
          borderRadius: 2,
          boxShadow: 4,
        }}
      >
        <CardContent>
          <Typography variant="h5" sx={{ fontWeight: "bold", mb: 2 }}>
            Overall Stats
          </Typography>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={3}
            alignItems="center"
          >
            {/* Donut chart */}
            <Box sx={{ width: "100%", maxWidth: 400, height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>

            {/* Numbers summary */}
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" gutterBottom>
                Total Completed: {stats.overall.total_completed}
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body1" gutterBottom>
                Estimated Time Spent Overall:
              </Typography>
              <Typography
                variant="h3"
                sx={{ color: "orange", fontWeight: "bold" }}
              >
                ≈ {Math.round(stats.time_spent_hours.OVERALL)} hours
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* --- By-Type Cards --- */}
      <Stack
        direction="row"
        flexWrap="wrap"
        spacing={2}
        useFlexGap
        sx={{ justifyContent: "center" }}
      >
        {Object.entries(stats.by_type).map(([mediaType, typeStats]) => (
          <Box key={mediaType} sx={{ flex: "1 1 300px", maxWidth: 400 }}>
            <StatCard
              title={`${mediaType.replace("_", " ")} Stats`}
              stats={typeStats}
              time_spent={stats.time_spent_hours[mediaType]}
            />
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

export default StatsPage;
