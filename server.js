const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

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
    description: "A powerful king is reborn into a new world.",
    cover: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600"
  },
  {
    id: "manga-collection",
    title: "Manga Collection",
    type: "Manga",
    status: "Collection",
    description: "A demo manga collection for Zyomira.",
    cover: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=600"
  },
  {
    id: "manhua-collection",
    title: "Manhua Collection",
    type: "Manhua",
    status: "Collection",
    description: "A demo manhua collection for Zyomira.",
    cover: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600"
  }
];

const demoPages = [
  "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200",
  "https://images.unsplash.com/photo-1613376023733-0a73315d9b06?w=1200",
  "https://images.unsplash.com/photo-1541560052-77ec1bbc09f7?w=1200",
  "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=1200"
];

app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Zyomira API",
    message: "Zyomira backend is running."
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Zyomira backend"
  });
});

app.get("/api/search", (req, res) => {
  const query = String(req.query.q || "")
    .trim()
    .toLowerCase();

  if (!query) {
    return res.json({
      query: "",
      results: []
    });
  }

  const results = titles.filter(item =>
    item.title.toLowerCase().includes(query) ||
    item.type.toLowerCase().includes(query) ||
    item.description.toLowerCase().includes(query)
  );

  res.json({
    query,
    results
  });
});

app.get("/api/title/:id", (req, res) => {
  const item = titles.find(
    title => title.id === req.params.id
  );

  if (!item) {
    return res.status(404).json({
      error: "Title not found"
    });
  }

  res.json(item);
});

app.get("/api/title/:id/chapters", (req, res) => {
  const item = titles.find(
    title => title.id === req.params.id
  );

  if (!item) {
    return res.status(404).json({
      error: "Title not found"
    });
  }

  const chapters = Array.from(
    { length: 20 },
    (_, index) => {
      const number = index + 1;

      return {
        number: number,
        title: `Chapter ${number}`,
        id: `${item.id}-chapter-${number}`
      };
    }
  );

  res.json({
    titleId: item.id,
    title: item.title,
    chapters: chapters
  });
});

app.get(
  "/api/title/:id/chapter/:chapter",
  (req, res) => {

    const item = titles.find(
      title => title.id === req.params.id
    );

    if (!item) {
      return res.status(404).json({
        error: "Title not found"
      });
    }

    const chapterNumber =
      Number(req.params.chapter);

    if (
      !Number.isInteger(chapterNumber) ||
      chapterNumber < 1 ||
      chapterNumber > 20
    ) {
      return res.status(404).json({
        error: "Chapter not found"
      });
    }

    const pages = demoPages.map(
      (url, index) => ({
        page: index + 1,
        url: url
      })
    );

    res.json({
      id: `${item.id}-chapter-${chapterNumber}`,
      title: item.title,
      chapter: chapterNumber,
      pages: pages
    });
  }
);

app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    path: req.path
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Zyomira backend running on port ${PORT}`
  );
});