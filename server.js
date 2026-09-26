const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({
    app: "Zyomira Backend",
    status: "online"
  });
});

app.get("/api/chapters/:mangaId", async (req, res) => {
  try {
    const mangaId = encodeURIComponent(req.params.mangaId);

    const url =
      `https://api.mangadex.org/manga/${mangaId}/feed` +
      `?translatedLanguage[]=en` +
      `&contentRating[]=safe` +
      `&order[chapter]=asc` +
      `&limit=100`;

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Chapter source returned an error"
      });
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    res.status(500).json({
      error: "Could not load chapters"
    });
  }
});

app.get("/api/pages/:chapterId", async (req, res) => {
  try {
    const chapterId = encodeURIComponent(req.params.chapterId);

    const response = await fetch(
      `https://api.mangadex.org/at-home/server/${chapterId}`
    );

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Could not load chapter pages"
      });
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    res.status(500).json({
      error: "Could not load chapter pages"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Zyomira backend running on port ${PORT}`);
});