\import { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Stack,
  CircularProgress,
} from "@mui/material";
import useApi from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";

export default function Contact() {
  const { user } = useAuth();
  const { post } = useApi();

  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    subject: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await post("/contact", form);
      setSuccess("✅ Message sent successfully! Our team will contact you soon.");
      setForm({
        name: user?.name || "",
        email: user?.email || "",
        subject: "",
        message: "",
      });
    } catch (err) {
      console.error("Contact send failed:", err);
      setError("❌ Failed to send message. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 4, maxWidth: 700, mx: "auto" }}>
      <Paper sx={{ p: 4, boxShadow: 3, borderRadius: 3 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          📩 Contact Us
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Have a question or feedback? We’d love to hear from you.
        </Typography>

        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">{success}</Alert>}

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: "grid", gap: 2, mt: 3 }}
        >
          <TextField
            label="Name"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            fullWidth
          />
          <TextField
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
            fullWidth
          />
          <TextField
            label="Subject"
            name="subject"
            value={form.subject}
            onChange={handleChange}
            required
            fullWidth
          />
          <TextField
            label="Message"
            name="message"
            value={form.message}
            onChange={handleChange}
            required
            fullWidth
            multiline
            minRows={4}
          />

          <Stack direction="row" spacing={2} alignItems="center">
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{
                bgcolor: "#1976d2",
                ":hover": { bgcolor: "#1565c0" },
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Send"}
            </Button>
            <Button
              variant="outlined"
              onClick={() =>
                setForm({
                  name: user?.name || "",
                  email: user?.email || "",
                  subject: "",
                  message: "",
                })
              }
            >
              Clear
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
