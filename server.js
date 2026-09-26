const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    name: "Zyomira API",
    status: "online",
    version: "1.0.0"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Zyomira backend"
  });
});

app.get("/api/search", (req, res) => {
  const query = String(req.query.q || "").trim();

  if (!query) {
    return res.json({
      results: []
    });
  }

  res.json({
    query,
    results: []
  });
});

app.get("/api/title/:id", (req, res) => {
  res.status(404).json({
    error: "Title not found",
    id: req.params.id
  });
});

app.get("/api/title/:id/chapters", (req, res) => {
  res.json({
    id: req.params.id,
    chapters: []
  });
});

app.get("/api/title/:id/chapter/:chapter", (req, res) => {
  res.json({
    id: req.params.id,
    chapter: req.params.chapter,
    pages: []
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Zyomira API running on port ${PORT}`);
});