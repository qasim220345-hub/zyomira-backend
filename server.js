const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const COMIX_API = "https://comix-api.vercel.app/api";

function absoluteImage(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("/")) {
    return "https://comix-api.vercel.app" + url;
  }

  return "https://comix-api.vercel.app/" + url;
}

async function fetchJSON(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Zyomira/1.0"
    }
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Comix API returned invalid JSON (${response.status})`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
      data?.message ||
      `Comix API HTTP ${response.status}`
    );
  }

  return data;
}

/* ---------------- HOME ---------------- */

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Zyomira backend",
    source: "comix"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Zyomira backend",
    source: "comix"
  });
});

/* ---------------- COMIX HOME ---------------- */

app.get("/api/comix/home", async (req, res) => {
  try {
    const data = await fetchJSON(
      `${COMIX_API}/manga/home?sfw=true`
    );

    const popular = Array.isArray(data?.popular)
      ? data.popular
      : [];

    const latest = Array.isArray(data?.latest)
      ? data.latest
      : [];

    const normalize = (item) => ({
      id: String(item.id || ""),
      hid: String(item.id || ""),
      slug: String(item.id || ""),
      title: item.title || "Unknown title",
      description: item.description || "",
      cover: absoluteImage(item.cover || item.img),
      thumbnail: absoluteImage(item.cover || item.img),
      chapter: item.chapter || "",
      status: item.status ?? null,
      score: item.score ?? null,
      type: item.type || "manga",
      source: "comix"
    });

    res.json({
      source: "comix",
      popular: popular.map(normalize),
      latest: latest.map(normalize)
    });
  } catch (error) {
    console.error("HOME ERROR:", error.message);

    res.status(502).json({
      error: "Could not load Comix home.",
      details: error.message
    });
  }
});

/* ---------------- SEARCH ---------------- */

app.get("/api/search", async (req, res) => {
  const q = String(req.query.q || "").trim();

  if (!q) {
    return res.json({
      source: "comix",
      query: "",
      count: 0,
      results: []
    });
  }

  try {
    /* Primary search */
    const searchURL =
      `${COMIX_API}/manga/search?q=` +
      encodeURIComponent(q) +
      `&sfw=true`;

    let data = await fetchJSON(searchURL);

    let results = Array.isArray(data?.results)
      ? data.results
      : [];

    /*
      If search returns nothing, try browse.
      This does NOT magically turn browse into search,
      but gives Zyomira a useful fallback if the API
      search endpoint temporarily returns an empty list.
    */

    if (!results.length) {
      try {
        const browseData = await fetchJSON(
          `${COMIX_API}/manga/browse?sfw=true&page=1&limit=50`
        );

        const browseResults = Array.isArray(browseData?.results)
          ? browseData.results
          : [];

        const queryLower = q.toLowerCase();

        results = browseResults.filter((item) => {
          const title = String(
            item.title || ""
          ).toLowerCase();

          return title.includes(queryLower);
        });
      } catch (fallbackError) {
        console.log(
          "Browse fallback failed:",
          fallbackError.message
        );
      }
    }

    const normalized = results
      .filter(Boolean)
      .map((item) => ({
        id: String(item.id || ""),
        hid: String(item.id || ""),
        slug: String(item.id || ""),

        title: item.title || "Unknown title",

        description:
          item.description ||
          item.synopsis ||
          "",

        cover: absoluteImage(
          item.cover || item.img
        ),

        thumbnail: absoluteImage(
          item.cover || item.img
        ),

        status: item.status ?? null,
        score: item.score ?? null,

        type:
          item.type ||
          "manga",

        source: "comix"
      }))
      .filter((item) => item.id);

    res.json({
      source: "comix",
      query: q,
      count: normalized.length,
      results: normalized
    });

  } catch (error) {
    console.error("SEARCH ERROR:", error.message);

    res.status(502).json({
      source: "comix",
      query: q,
      count: 0,
      results: [],
      error: "Comix search failed.",
      details: error.message
    });
  }
});

/* ---------------- DETAILS ---------------- */

app.get("/api/source/comix/title/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const data = await fetchJSON(
      `${COMIX_API}/manga/${encodeURIComponent(id)}?sfw=true`
    );

    const comic =
      data?.comic ||
      data?.manga ||
      data;

    if (!comic || !comic.id) {
      return res.status(404).json({
        error: "Manga not found."
      });
    }

    res.json({
      source: "comix",

      id: String(comic.id),

      title:
        comic.title ||
        "Unknown title",

      description:
        comic.description ||
        comic.synopsis ||
        "",

      synopsis:
        comic.synopsis ||
        comic.description ||
        "",

      cover: absoluteImage(
        comic.cover ||
        comic.img
      ),

      thumbnail: absoluteImage(
        comic.cover ||
        comic.img
      ),

      author:
        comic.author ||
        comic.authors ||
        "",

      artist:
        comic.artist ||
        comic.artists ||
        "",

      genres:
        Array.isArray(comic.genres)
          ? comic.genres
          : [],

      status:
        comic.status ??
        null,

      type:
        comic.type ||
        "manga",

      score:
        comic.score ??
        null,

      content_rating:
        comic.content_rating ||
        "safe"
    });

  } catch (error) {
    console.error("DETAIL ERROR:", error.message);

    res.status(502).json({
      error: "Could not load manga details.",
      details: error.message
    });
  }
});

/* ---------------- CHAPTERS ---------------- */

app.get(
  "/api/source/comix/title/:id/chapters",
  async (req, res) => {
    try {
      const id = req.params.id;

      const page = Math.max(
        1,
        Number(req.query.page || 1)
      );

      const limit = Math.min(
        100,
        Math.max(
          1,
          Number(req.query.limit || 100)
        )
      );

      const data = await fetchJSON(
        `${COMIX_API}/manga/${encodeURIComponent(id)}/chapters` +
        `?page=${page}&limit=${limit}`
      );

      const chapters = Array.isArray(data?.chapters)
        ? data.chapters
        : Array.isArray(data)
          ? data
          : [];

      const normalized = chapters
        .map((chapter) => ({
          id: String(
            chapter.id ||
            chapter.chapter_id ||
            chapter.chapterId ||
            ""
          ),

          chapter:
            chapter.chapter ??
            chapter.number ??
            chapter.chapter_number ??
            "",

          number:
            chapter.number ??
            chapter.chapter ??
            chapter.chapter_number ??
            "",

          title:
            chapter.title ||
            "",

          volume:
            chapter.volume ??
            null,

          scanlationGroup:
            chapter.scanlation_group ||
            chapter.group ||
            chapter.scanlator_name ||
            null,

          uploadedAt:
            chapter.uploaded_at ||
            chapter.created_at ||
            chapter.date_added ||
            null,

          source: "comix"
        }))
        .filter((chapter) => chapter.id);

      res.json({
        source: "comix",
        mangaId: id,
        page,
        limit,
        count: normalized.length,
        chapters: normalized
      });

    } catch (error) {
      console.error(
        "CHAPTER ERROR:",
        error.message
      );

      res.status(502).json({
        error: "Could not load chapters.",
        details: error.message
      });
    }
  }
);

/* ---------------- READER ---------------- */

app.get(
  "/api/source/comix/chapter/:chapterId",
  async (req, res) => {
    try {
      const chapterId =
        String(req.params.chapterId);

      const data = await fetchJSON(
        `${COMIX_API}/manga/read?chapterId=` +
        encodeURIComponent(chapterId)
      );

      const images =
        Array.isArray(data?.images)
          ? data.images
          : [];

      const pages = images
        .map((image, index) => {
          const rawURL =
            typeof image === "string"
              ? image
              : image?.url ||
                image?.src ||
                "";

          return {
            index,
            url: absoluteImage(rawURL),
            width:
              typeof image === "object"
                ? image.width || null
                : null,
            height:
              typeof image === "object"
                ? image.height || null
                : null
          };
        })
        .filter((page) => page.url);

      if (!pages.length) {
        return res.status(404).json({
          error:
            "No chapter page images were returned.",
          chapterId,
          pages: []
        });
      }

      res.json({
        source: "comix",
        chapterId,
        count: pages.length,
        total_images:
          data?.total_images ??
          pages.length,
        pages
      });

    } catch (error) {
      console.error(
        "READER ERROR:",
        error.message
      );

      res.status(502).json({
        error:
          "Could not load chapter pages.",
        chapterId: req.params.chapterId,
        details: error.message
      });
    }
  }
);

/* ---------------- IMAGE PROXY ---------------- */

app.get("/api/image", async (req, res) => {
  const imageURL =
    String(req.query.url || "").trim();

  if (!imageURL) {
    return res.status(400).send(
      "Missing image URL"
    );
  }

  try {
    const response = await fetch(
      imageURL,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 Zyomira/1.0",
          "Referer":
            "https://comix.to/"
        }
      }
    );

    if (!response.ok) {
      return res.status(
        response.status
      ).send(
        `Image request failed: ${response.status}`
      );
    }

    const buffer =
      Buffer.from(
        await response.arrayBuffer()
      );

    res.set(
      "Content-Type",
      response.headers.get(
        "content-type"
      ) || "image/jpeg"
    );

    res.set(
      "Cache-Control",
      "public, max-age=86400"
    );

    res.set(
      "Access-Control-Allow-Origin",
      "*"
    );

    res.send(buffer);

  } catch (error) {
    console.error(
      "IMAGE ERROR:",
      error.message
    );

    res.status(502).send(
      "Could not load image."
    );
  }
});

/* ---------------- SOURCES ---------------- */

app.get("/api/sources", (req, res) => {
  res.json({
    sources: [
      {
        id: "comix",
        name: "Comix",
        enabled: true,
        search: true,
        details: true,
        chapters: true,
        reader: true,
        types: [
          "manga",
          "manhwa",
          "manhua"
        ]
      }
    ]
  });
});

/* ---------------- REPOSITORY ---------------- */

app.get("/api/repository", (req, res) => {
  res.json({
    name: "Zyomira Repository",
    version: 3,

    extensions: [
      {
        id: "comix",
        name: "Comix",
        type: "manga",

        supports: [
          "manga",
          "manhwa",
          "manhua"
        ],

        reader: true,
        enabled: true
      }
    ]
  });
});

/* ---------------- ERROR HANDLER ---------------- */

app.use((err, req, res, next) => {
  console.error(
    "SERVER ERROR:",
    err
  );

  res.status(500).json({
    error: "Internal server error."
  });
});

/* ---------------- START ---------------- */

app.listen(PORT, () => {
  console.log(
    `Zyomira backend running on port ${PORT}`
  );
});