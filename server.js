const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const titles = [
  {
    id: "solo-leveling",
    title: "Solo Leveling",
    type: "Manhwa",
    status: "Completed",
    description: "Fantasy action series.",
    cover: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600"
  },
  {
    id: "beginning-after-end",
    title: "The Beginning After the End",
    type: "Manhwa",
    status: "Ongoing",
    description: "A fantasy adventure in another world.",
    cover: "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=600"
  },
  {
    id: "manga-collection",
    title: "Manga Collection",
    type: "Manga",
    status: "Collection",
    description: "A manga collection for Zyomira.",
    cover: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=600"
  },
  {
    id: "manhua-collection",
    title: "Manhua Collection",
    type: "Manhua",
    status: "Collection",
    description: "A manhua collection for Zyomira.",
    cover: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=600"
  }
];

app.get("/", (req, res) => {
  res.json({
    name: "Zyomira API",
    status: "online",
    version: "1.1.0"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Zyomira backend"
  });
});

app.get("/api/search", (req, res) => {
  const query = String(req.query.q || "").trim().toLowerCase();

  if (!query) {
    return res.json({
      results: []
    });
  }

  const results = titles.filter(item =>
    item.title.toLowerCase().includes(query) ||
    item.type.toLowerCase().includes(query)
  );

  res.json({
    query,
    results
  });
});

app.get("/api/title/:id", (req, res) => {
  const title = titles.find(item => item.id === req.params.id);

  if (!title) {
    return res.status(404).json({
      error: "Title not found"
    });
  }

  res.json(title);
});

app.get("/api/title/:id/chapters", (req, res) => {
  const title = titles.find(item => item.id === req.params.id);

  if (!title) {
    return res.status(404).json({
      error: "Title not found"
    });
  }

  const chapters = Array.from({ length: 20 }, (_, index) => ({
    number: index + 1,
    title: `Chapter ${index + 1}`
  }));

  res.json({
    id: title.id,
    chapters
  });
});

app.get("/api/title/:id/chapter/:chapter", (req, res) => {
  const title = titles.find(item => item.id === req.params.id);

  if (!title) {
    return res.status(404).json({
      error: "Title not found"
    });
  }

  res.json({
    id: title.id,
    title: title.title,
    chapter: Number(req.params.chapter),
    pages: []
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Zyomira API running on port ${PORT}`);
});