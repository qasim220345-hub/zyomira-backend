const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const COMICK_PROXY =
  "https://comick-api-proxy.notaspider.dev/api/v1.0";

/* -------------------------
   HOME
------------------------- */

app.get("/", (req, res) => {
  res.json({
    service: "Zyomira backend",
    status: "online",
    version: "1.1.0"
  });
});

/* -------------------------
   HEALTH
------------------------- */

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Zyomira backend"
  });
});

/* -------------------------
   SEARCH
------------------------- */

app.get("/api/search", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();

    if (!query) {
      return res.status(400).json({
        error: "Search query is required"
      });
    }

    const url =
      `${COMICK_PROXY}/search?q=${encodeURIComponent(query)}`;

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Comick search is temporarily unavailable.",
        source: "comick",
        details: `HTTP ${response.status}`
      });
    }

    const data = await response.json();

    const rawResults = Array.isArray(data)
      ? data
      : Array.isArray(data.results)
        ? data.results
        : [];

    const results = rawResults
      .filter(item => {
        const rating =
          String(
            item.content_rating ||
            item.contentRating ||
            ""
          ).toLowerCase();

        return rating !== "pornographic";
      })
      .map(item => ({
        id: item.hid || item.id,
        hid: item.hid || item.id,
        slug: item.slug || "",
        title: item.title || "Unknown title",
        description: item.desc || item.description || "",
        cover:
          item.cover ||
          item.thumbnail ||
          "",
        thumbnail:
          item.thumbnail ||
          item.cover ||
          "",
        country: item.country || "",
        status: item.status ?? null,
        year: item.year ?? null,
        lastChapter:
          item.last_chapter ??
          item.lastChapter ??
          null,
        contentRating:
          item.content_rating ||
          item.contentRating ||
          "safe",
        media_type:
          item.media_type ||
          "manga",
        source: "comick"
      }));

    res.json({
      source: "comick",
      query,
      count: results.length,
      results
    });

  } catch (error) {
    console.error("SEARCH ERROR:", error);

    res.status(500).json({
      error: "Failed to search Comick",
      details: error.message
    });
  }
});

/* -------------------------
   TITLE DETAILS
------------------------- */

app.get("/api/source/comick/title/:hid", async (req, res) => {
  try {
    const { hid } = req.params;

    const url =
      `${COMICK_PROXY}/comic/${encodeURIComponent(hid)}`;

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Could not load manga details",
        source: "comick",
        details: `HTTP ${response.status}`
      });
    }

    const data = await response.json();

    res.json(data);

  } catch (error) {
    console.error("TITLE ERROR:", error);

    res.status(500).json({
      error: "Failed to load manga details",
      details: error.message
    });
  }
});

/* -------------------------
   CHAPTERS
------------------------- */

app.get(
  "/api/source/comick/title/:hid/chapters",
  async (req, res) => {
    try {
      const { hid } = req.params;

      const lang = String(
        req.query.lang || "gb"
      );

      const page = String(
        req.query.page || "1"
      );

      const url =
        `${COMICK_PROXY}/comic/${encodeURIComponent(hid)}/chapters` +
        `?lang=${encodeURIComponent(lang)}` +
        `&page=${encodeURIComponent(page)}`;

      console.log("CHAPTER URL:", url);

      const response = await fetch(url);

      if (!response.ok) {
        return res.status(response.status).json({
          error: "Could not load chapters",
          source: "comick",
          details: `HTTP ${response.status}`
        });
      }

      const data = await response.json();

      res.json(data);

    } catch (error) {
      console.error("CHAPTER ERROR:", error);

      res.status(500).json({
        error: "Failed to load chapters",
        details: error.message
      });
    }
  }
);

/* -------------------------
   CHAPTER PAGES
------------------------- */

app.get(
  "/api/source/comick/chapter/:chapterHid",
  async (req, res) => {
    try {
      const { chapterHid } = req.params;

      const url =
        `${COMICK_PROXY}/chapter/${encodeURIComponent(chapterHid)}`;

      const response = await fetch(url);

      if (!response.ok) {
        return res.status(response.status).json({
          error: "Could not load chapter",
          source: "comick",
          details: `HTTP ${response.status}`
        });
      }

      const data = await response.json();

      res.json(data);

    } catch (error) {
      console.error("CHAPTER PAGE ERROR:", error);

      res.status(500).json({
        error: "Failed to load chapter",
        details: error.message
      });
    }
  }
);

/* -------------------------
   IMAGE PROXY
------------------------- */

app.get("/api/image", async (req, res) => {
  try {
    const imageUrl = String(req.query.url || "").trim();

    if (!imageUrl) {
      return res.status(400).json({
        error: "Image URL is required"
      });
    }

    const response = await fetch(imageUrl);

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Could not load image"
      });
    }

    const contentType =
      response.headers.get("content-type") ||
      "image/jpeg";

    const buffer =
      Buffer.from(await response.arrayBuffer());

    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=86400");

    res.send(buffer);

  } catch (error) {
    console.error("IMAGE ERROR:", error);

    res.status(500).json({
      error: "Failed to load image",
      details: error.message
    });
  }
});

/* -------------------------
   REPOSITORY
------------------------- */

app.get("/api/repository", async (req, res) => {
  try {
    const url =
      "https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json";

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Could not load repository",
        details: `HTTP ${response.status}`
      });
    }

    const data = await response.json();

    res.json(data);

  } catch (error) {
    console.error("REPOSITORY ERROR:", error);

    res.status(500).json({
      error: "Failed to load repository",
      details: error.message
    });
  }
});

/* -------------------------
   SOURCES
------------------------- */

app.get("/api/sources", (req, res) => {
  res.json({
    sources: [
      {
        id: "comick",
        name: "Comick",
        type: "manga",
        enabled: true
      }
    ]
  });
});

/* -------------------------
   START SERVER
------------------------- */

app.listen(PORT, () => {
  console.log(
    `Zyomira backend running on port ${PORT}`
  );
});