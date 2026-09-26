const express = require("express");

const app = express();
const PORT = process.env.PORT || 10000;

const MDX = "https://api.mangadex.org";
const SOURCE = "mangadex";

const MD_HEADERS = {
  "User-Agent": "Zyomira/1.0",
  "Accept": "application/json"
};

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});


/* ---------------- HOME ---------------- */

app.get("/", (req, res) => {
  res.json({
    service: "Zyomira backend",
    status: "online",
    source: SOURCE
  });
});


/* ---------------- HEALTH ---------------- */

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Zyomira backend",
    source: SOURCE
  });
});


/* ---------------- SEARCH ---------------- */

app.get("/api/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();

    if (!q) {
      return res.json([]);
    }

    const url =
      MDX +
      "/manga?title=" +
      encodeURIComponent(q) +
      "&limit=20" +
      "&includes[]=cover_art" +
      "&contentRating[]=safe" +
      "&contentRating[]=suggestive" +
      "&availableTranslatedLanguage[]=en";

    const response = await fetch(url, {
      headers: MD_HEADERS
    });

    const text = await response.text();

    if (!response.ok) {
      console.error("Search error:", response.status, text);
      return res.status(response.status).json({
        error: "MangaDex search failed"
      });
    }

    const data = JSON.parse(text);

    const results = (data.data || []).map(item => {
      const attrs = item.attributes || {};

      const coverRel = (item.relationships || []).find(
        r => r.type === "cover_art"
      );

      const fileName =
        coverRel?.attributes?.fileName || "";

      const cover = fileName
        ? "https://uploads.mangadex.org/covers/" +
          item.id +
          "/" +
          fileName
        : "";

      return {
        id: item.id,
        title:
          attrs.title?.en ||
          Object.values(attrs.title || {})[0] ||
          "Unknown",
        description:
          attrs.description?.en ||
          Object.values(attrs.description || {})[0] ||
          "",
        status: attrs.status || "unknown",
        year: attrs.year || "",
        type: "Manga",
        cover
      };
    });

    res.json(results);

  } catch (error) {
    console.error("Search exception:", error);

    res.status(500).json({
      error: "Search failed"
    });
  }
});


/* ---------------- TITLE ---------------- */

app.get("/api/source/comix/title/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const url =
      MDX +
      "/manga/" +
      encodeURIComponent(id) +
      "?includes[]=cover_art";

    const response = await fetch(url, {
      headers: MD_HEADERS
    });

    const text = await response.text();

    if (!response.ok) {
      console.error("Title error:", response.status, text);

      return res.status(response.status).json({
        error: "MangaDex title request failed"
      });
    }

    const data = JSON.parse(text);
    const item = data.data;

    if (!item) {
      return res.status(404).json({
        error: "Title not found"
      });
    }

    const attrs = item.attributes || {};

    const coverRel = (item.relationships || []).find(
      r => r.type === "cover_art"
    );

    const fileName =
      coverRel?.attributes?.fileName || "";

    const cover = fileName
      ? "https://uploads.mangadex.org/covers/" +
        id +
        "/" +
        fileName
      : "";

    res.json({
      id,
      title:
        attrs.title?.en ||
        Object.values(attrs.title || {})[0] ||
        "Unknown",
      description:
        attrs.description?.en ||
        Object.values(attrs.description || {})[0] ||
        "",
      status: attrs.status || "unknown",
      type: "Manga",
      cover
    });

  } catch (error) {
    console.error("Title exception:", error);

    res.status(500).json({
      error: "Could not load title"
    });
  }
});


/* ---------------- CHAPTER LIST ---------------- */

app.get("/api/source/comix/title/:id/chapters", async (req, res) => {
  try {
    const mangaId = req.params.id;

    const url =
      MDX +
      "/chapter?" +
      "manga[]=" +
      encodeURIComponent(mangaId) +
      "&translatedLanguage[]=en" +
      "&contentRating[]=safe" +
      "&contentRating[]=suggestive" +
      "&order[chapter]=asc" +
      "&order[volume]=asc" +
      "&limit=100";

    const response = await fetch(url, {
      headers: MD_HEADERS
    });

    const text = await response.text();

    if (!response.ok) {
      console.error(
        "Chapter list error:",
        response.status,
        text
      );

      return res.status(response.status).json({
        error: "MangaDex chapter list failed"
      });
    }

    const data = JSON.parse(text);

    const chapters = (data.data || []).map(item => {
      const attrs = item.attributes || {};

      return {
        id: item.id,
        number: attrs.chapter || "0",
        title: attrs.title || "",
        volume: attrs.volume || "",
        pages: attrs.pages || 0,
        publishedAt: attrs.publishAt || ""
      };
    });

    res.json({
      chapters,
      total: data.total || chapters.length
    });

  } catch (error) {
    console.error("Chapter list exception:", error);

    res.status(500).json({
      error: "Could not load chapters"
    });
  }
});


/* ---------------- READER ---------------- */

app.get("/api/source/comix/chapter/:chapterId", async (req, res) => {
  const chapterId = req.params.chapterId;

  console.log("Reader request:", chapterId);

  try {
    const url =
      MDX +
      "/at-home/server/" +
      encodeURIComponent(chapterId);

    const response = await fetch(url, {
      headers: MD_HEADERS
    });

    const text = await response.text();

    console.log(
      "MangaDex reader status:",
      response.status
    );

    console.log(
      "MangaDex response:",
      text.slice(0, 1000)
    );

    if (!response.ok) {
      return res.status(response.status).json({
        error: "MangaDex reader request failed",
        status: response.status,
        details: text.slice(0, 1000)
      });
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch (error) {
      console.error("Reader JSON parse error:", error);

      return res.status(502).json({
        error: "MangaDex returned invalid JSON"
      });
    }

    /*
      MangaDex normally returns:

      {
        baseUrl: "...",
        chapter: {
          hash: "...",
          data: [...]
        }
      }
    */

    const baseUrl =
      data.baseUrl ||
      data.base_url ||
      "";

    const chapter =
      data.chapter ||
      data.data?.chapter ||
      null;

    if (!baseUrl || !chapter) {
      console.error(
        "Invalid reader structure:",
        JSON.stringify(data).slice(0, 2000)
      );

      return res.status(502).json({
        error: "Invalid MangaDex chapter data",
        responseKeys: Object.keys(data || {}),
        hasBaseUrl: !!baseUrl,
        hasChapter: !!chapter
      });
    }

    const hash = chapter.hash || "";

    /*
      Normal quality pages.
    */
    let filenames =
      Array.isArray(chapter.data)
        ? chapter.data
        : [];

    /*
      If normal pages are missing, use dataSaver.
    */
    if (!filenames.length) {
      filenames =
        Array.isArray(chapter.dataSaver)
          ? chapter.dataSaver
          : [];
    }

    if (!hash || !filenames.length) {
      console.error(
        "Chapter exists but contains no pages:",
        JSON.stringify({
          hash,
          normalPages:
            Array.isArray(chapter.data)
              ? chapter.data.length
              : 0,
          saverPages:
            Array.isArray(chapter.dataSaver)
              ? chapter.dataSaver.length
              : 0
        })
      );

      return res.status(502).json({
        error: "Chapter contains no readable pages",
        hash: !!hash,
        normalPages:
          Array.isArray(chapter.data)
            ? chapter.data.length
            : 0,
        saverPages:
          Array.isArray(chapter.dataSaver)
            ? chapter.dataSaver.length
            : 0
      });
    }

    /*
      Build page URLs.

      Example:
      https://server/data/hash/page.jpg
    */
    const pages = filenames.map(filename => {
      return (
        baseUrl +
        "/data/" +
        encodeURIComponent(hash) +
        "/" +
        encodeURIComponent(filename)
      );
    });

    console.log(
      "Reader pages:",
      pages.length
    );

    res.json({
      source: SOURCE,
      chapterId,
      pages,
      count: pages.length
    });

  } catch (error) {
    console.error("Reader error:", error);

    res.status(500).json({
      error: "Reader request failed",
      message: error.message
    });
  }
});


/* ---------------- IMAGE PROXY ---------------- */

app.get("/api/image", async (req, res) => {
  try {
    const imageUrl = String(req.query.url || "");

    if (!imageUrl) {
      return res.status(400).send("Missing image URL");
    }

    if (
      !imageUrl.startsWith("https://uploads.mangadex.org/") &&
      !imageUrl.includes("mangadex")
    ) {
      return res.status(403).send("Image host not allowed");
    }

    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Zyomira/1.0",
        "Referer": "https://mangadex.org/"
      }
    });

    if (!response.ok) {
      return res.status(response.status).send(
        "Image request failed"
      );
    }

    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") ||
      "image/jpeg"
    );

    res.setHeader(
      "Cache-Control",
      "public, max-age=86400"
    );

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    res.send(buffer);

  } catch (error) {
    console.error("Image proxy error:", error);

    res.status(500).send(
      "Could not load image"
    );
  }
});


/* ---------------- SOURCES ---------------- */

app.get("/api/sources", (req, res) => {
  res.json([
    {
      id: "mangadex",
      name: "MangaDex",
      type: "Manga / MangaDex",
      enabled: true
    }
  ]);
});


/* ---------------- REPOSITORY ---------------- */

app.get("/api/repository", async (req, res) => {
  try {
    const repositoryUrl =
      String(req.query.url || "").trim();

    if (!repositoryUrl) {
      return res.status(400).json({
        error: "Missing repository URL"
      });
    }

    if (!/^https?:\/\//i.test(repositoryUrl)) {
      return res.status(400).json({
        error: "Invalid repository URL"
      });
    }

    const response = await fetch(repositoryUrl, {
      headers: {
        "User-Agent": "Zyomira/1.0",
        "Accept": "application/json"
      }
    });

    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          "Repository request failed: " +
          response.status
      });
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return res.status(400).json({
        error: "Repository is not valid JSON"
      });
    }

    let extensions = [];

    if (Array.isArray(data)) {
      extensions = data;
    } else if (Array.isArray(data.extensions)) {
      extensions = data.extensions;
    } else if (Array.isArray(data.sources)) {
      extensions = data.sources;
    } else if (Array.isArray(data.data)) {
      extensions = data.data;
    }

    res.json({
      ok: true,
      repository: {
        name: data.name || data.title || "Repository",
        format: "json"
      },
      extensions
    });

  } catch (error) {
    console.error("Repository error:", error);

    res.status(500).json({
      error: error.message || "Could not read repository"
    });
  }
});


/* ---------------- START ---------------- */

app.listen(PORT, () => {
  console.log(
    "Zyomira backend running on port " + PORT
  );
});