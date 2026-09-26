const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const COMICK_PROXY =
  "https://comick-api-proxy.notaspider.dev/api/v1.0";

const COMICK_PAGES_API =
  "https://comick-api-proxy.notaspider.dev/api";

const IMAGE_HOST =
  "https://meo.comick.pictures/";


// --------------------------------------------------
// Helpers
// --------------------------------------------------

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "User-Agent": "Zyomira/1.0",
      ...(options.headers || {})
    }
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Invalid JSON response (${response.status})`
    );
  }

  if (!response.ok) {
    const error = new Error(
      data?.error ||
      data?.message ||
      `HTTP ${response.status}`
    );

    error.status = response.status;
    throw error;
  }

  return data;
}


function makeImageUrl(value) {
  if (!value) return null;

  if (typeof value === "string") {
    if (
      value.startsWith("http://") ||
      value.startsWith("https://")
    ) {
      return value;
    }

    return IMAGE_HOST + value.replace(/^\/+/, "");
  }

  if (typeof value === "object") {
    if (value.url) {
      return makeImageUrl(value.url);
    }

    if (value.src) {
      return makeImageUrl(value.src);
    }

    if (value.image) {
      return makeImageUrl(value.image);
    }

    if (value.imageUrl) {
      return makeImageUrl(value.imageUrl);
    }

    if (value.b2key) {
      return IMAGE_HOST + value.b2key;
    }
  }

  return null;
}


function extractImages(data) {
  const candidates = [
    data?.pages,
    data?.images,
    data?.md_images,
    data?.chapter?.md_images,
    data?.comic?.md_images,
    data?.data?.pages,
    data?.data?.images,
    data?.data?.md_images,
    data?.data?.chapter?.md_images,
    data?.chapter?.pages,
    data?.chapter?.images
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;

    const pages = candidate
      .map((item) => makeImageUrl(item))
      .filter(Boolean)
      .map((url, index) => ({
        index,
        url
      }));

    if (pages.length > 0) {
      return pages;
    }
  }

  return [];
}


// --------------------------------------------------
// Basic routes
// --------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    service: "Zyomira backend",
    status: "online"
  });
});


app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Zyomira backend"
  });
});


// --------------------------------------------------
// Search
// --------------------------------------------------

app.get("/api/search", async (req, res) => {
  const q = String(req.query.q || "").trim();

  if (!q) {
    return res.status(400).json({
      error: "Search query is required."
    });
  }

  try {
    const url =
      COMICK_PROXY +
      "/search?q=" +
      encodeURIComponent(q);

    const raw = await fetchJSON(url);

    const sourceResults =
      Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.results)
          ? raw.results
          : Array.isArray(raw?.data)
            ? raw.data
            : [];

    const results = sourceResults
      .filter(
        item =>
          String(item?.content_rating || "").toLowerCase() !==
          "pornographic"
      )
      .map(item => ({
        id: item?.hid || item?.id || null,
        hid: item?.hid || null,
        slug: item?.slug || null,

        title:
          item?.title ||
          item?.md_titles?.find(x => x.lang === "en")?.title ||
          "Unknown title",

        description:
          item?.description ||
          "",

        cover:
          makeImageUrl(
            item?.md_covers?.[0]?.b2key ||
            item?.cover ||
            item?.cover_url
          ),

        thumbnail:
          makeImageUrl(
            item?.md_covers?.[0]?.b2key ||
            item?.cover ||
            item?.cover_url
          ),

        country: item?.country || null,
        status: item?.status || null,
        year: item?.year || null,

        lastChapter:
          item?.last_chapter ??
          item?.lastChapter ??
          null,

        contentRating:
          item?.content_rating ||
          "safe",

        media_type:
          item?.media_type ||
          "manga",

        source: "comick"
      }));

    res.json({
      source: "comick",
      query: q,
      count: results.length,
      results
    });

  } catch (error) {
    console.error("Search error:", error);

    res.status(error.status || 500).json({
      error: "Comick search failed.",
      source: "comick",
      details: error.message
    });
  }
});


// --------------------------------------------------
// Manga details
// --------------------------------------------------

app.get(
  "/api/source/comick/title/:hid",
  async (req, res) => {
    const hid = req.params.hid;

    try {
      const url =
        COMICK_PROXY +
        "/comic/" +
        encodeURIComponent(hid);

      const data = await fetchJSON(url);

      res.json(data);

    } catch (error) {
      console.error("Title error:", error);

      res.status(error.status || 500).json({
        error: "Could not load manga details.",
        source: "comick",
        details: error.message
      });
    }
  }
);


// --------------------------------------------------
// Chapters
// --------------------------------------------------

app.get(
  "/api/source/comick/title/:hid/chapters",
  async (req, res) => {
    const hid = req.params.hid;

    const lang =
      String(req.query.lang || "en");

    const page =
      Number(req.query.page || 1);

    try {
      const url =
        COMICK_PROXY +
        "/comic/" +
        encodeURIComponent(hid) +
        "/chapters" +
        "?lang=" +
        encodeURIComponent(lang) +
        "&page=" +
        encodeURIComponent(page);

      const data = await fetchJSON(url);

      res.json(data);

    } catch (error) {
      console.error("Chapters error:", error);

      res.status(error.status || 500).json({
        error: "Could not load chapters.",
        source: "comick",
        details: error.message
      });
    }
  }
);


// --------------------------------------------------
// Chapter information
// --------------------------------------------------

app.get(
  "/api/source/comick/chapter/:chapterHid",
  async (req, res) => {
    const chapterHid =
      req.params.chapterHid;

    try {
      const url =
        COMICK_PAGES_API +
        "/chapter/" +
        encodeURIComponent(chapterHid);

      const data = await fetchJSON(url);

      const pages =
        extractImages(data);

      res.json({
        ...data,
        pages
      });

    } catch (error) {
      console.error("Chapter error:", error);

      res.status(error.status || 500).json({
        error: "Could not load chapter.",
        source: "comick",
        details: error.message,
        pages: []
      });
    }
  }
);


// --------------------------------------------------
// NEW: Chapter page images
// --------------------------------------------------

app.get(
  "/api/source/comick/chapter/:chapterHid/pages",
  async (req, res) => {
    const chapterHid =
      req.params.chapterHid;

    try {
      /*
       * Try the dedicated Comick pages endpoint first.
       *
       * This endpoint is useful when the normal chapter
       * response does not contain md_images.
       */

      const endpoints = [
        `${COMICK_PAGES_API}/comick/pages?hid=${encodeURIComponent(chapterHid)}`,

        `${COMICK_PAGES_API}/chapter/${encodeURIComponent(chapterHid)}`,

        `${COMICK_PROXY}/chapter/${encodeURIComponent(chapterHid)}?tachiyomi=true`
      ];

      let pages = [];
      let lastError = null;

      for (const url of endpoints) {
        try {
          console.log("Trying chapter pages:", url);

          const data =
            await fetchJSON(url);

          pages =
            extractImages(data);

          /*
           * Some page endpoints return a raw array
           * of image URLs.
           */
          if (
            pages.length === 0 &&
            Array.isArray(data)
          ) {
            pages = data
              .map((item) => makeImageUrl(item))
              .filter(Boolean)
              .map((url, index) => ({
                index,
                url
              }));
          }

          if (pages.length > 0) {
            break;
          }

        } catch (error) {
          lastError = error;
          console.log(
            "Pages endpoint failed:",
            error.message
          );
        }
      }

      if (pages.length === 0) {
        return res.status(404).json({
          error:
            "This chapter did not return page images yet.",
          chapterHid,
          pages: [],
          details:
            lastError?.message ||
            "No image URLs were returned."
        });
      }

      res.json({
        source: "comick",
        chapterHid,
        count: pages.length,
        pages
      });

    } catch (error) {
      console.error(
        "Chapter pages error:",
        error
      );

      res.status(500).json({
        error:
          "Could not load chapter page images.",
        chapterHid,
        pages: [],
        details: error.message
      });
    }
  }
);


// --------------------------------------------------
// Image proxy
// --------------------------------------------------

app.get("/api/image", async (req, res) => {
  const imageUrl =
    String(req.query.url || "").trim();

  if (!imageUrl) {
    return res.status(400).json({
      error: "Image URL is required."
    });
  }

  try {
    const response =
      await fetch(imageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 Zyomira/1.0",
          "Referer":
            "https://comick.io/"
        }
      });

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          "Image request failed."
      });
    }

    const contentType =
      response.headers.get(
        "content-type"
      ) || "image/jpeg";

    const buffer =
      Buffer.from(
        await response.arrayBuffer()
      );

    res.setHeader(
      "Content-Type",
      contentType
    );

    res.setHeader(
      "Cache-Control",
      "public, max-age=604800"
    );

    res.setHeader(
      "Access-Control-Allow-Origin",
      "*"
    );

    res.send(buffer);

  } catch (error) {
    console.error(
      "Image proxy error:",
      error
    );

    res.status(500).json({
      error:
        "Could not proxy image.",
      details:
        error.message
    });
  }
});


// --------------------------------------------------
// Repository
// --------------------------------------------------

app.get("/api/repository", async (req, res) => {
  res.json({
    name: "Zyomira Repository",
    version: 1,
    extensions: []
  });
});


// --------------------------------------------------
// Sources
// --------------------------------------------------

app.get("/api/sources", (req, res) => {
  res.json({
    sources: [
      {
        id: "comick",
        name: "Comick",
        enabled: true,
        search: true,
        chapters: true,
        pages: true
      }
    ]
  });
});


// --------------------------------------------------
// Start
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(
    `Zyomira backend running on port ${PORT}`
  );
});