const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const COMICK_API = "https://api.comick.io";
const COMICK_SITE = "https://comick.io";
const IMAGE_HOST = "https://meo.comick.pictures";

const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36";

/* -------------------------------------------------------
   Basic helpers
------------------------------------------------------- */

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": USER_AGENT,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.text();
}

function safeText(value) {
  return typeof value === "string" ? value : "";
}

function getCover(comic) {
  if (!comic) return "";

  if (comic.md_covers && comic.md_covers.length) {
    const cover = comic.md_covers[0];

    if (cover.b2key) {
      return `${IMAGE_HOST}/${cover.b2key}`;
    }
  }

  if (comic.thumbnail) return comic.thumbnail;

  return "";
}

/* -------------------------------------------------------
   Health
------------------------------------------------------- */

app.get("/", (req, res) => {
  res.json({
    service: "Zyomira backend",
    version: "2.0.0",
    status: "online",
    source: "Comick adapter"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Zyomira backend",
    version: "2.0.0",
    source: "Comick"
  });
});

/* -------------------------------------------------------
   Source list
------------------------------------------------------- */

app.get("/api/sources", (req, res) => {
  res.json({
    sources: [
      {
        id: "comick",
        name: "Comick",
        type: "manga",
        supports: [
          "manga",
          "manhwa",
          "manhua",
          "search",
          "chapters",
          "reader"
        ],
        online: true
      }
    ]
  });
});

/* -------------------------------------------------------
   REAL SEARCH
------------------------------------------------------- */

app.get("/api/search", async (req, res) => {
  const q = safeText(req.query.q).trim();

  if (!q) {
    return res.json({
      source: "comick",
      results: []
    });
  }

  try {
    const url =
      `${COMICK_API}/v1.0/search/` +
      `?q=${encodeURIComponent(q)}` +
      `&limit=20` +
      `&page=1`;

    const data = await fetchJson(url);

    const raw = Array.isArray(data)
      ? data
      : Array.isArray(data?.comics)
        ? data.comics
        : Array.isArray(data?.results)
          ? data.results
          : [];

    const results = raw
      .filter(item => {
        // Keep the normal/safe catalogue only.
        const rating =
          item.content_rating ||
          item.contentRating ||
          "safe";

        return rating !== "pornographic";
      })
      .map((item, index) => ({
        id: item.hid || item.id || `comick-${index}`,
        hid: item.hid || item.id || "",
        slug: item.slug || "",
        title:
          item.title ||
          item.name ||
          "Unknown title",
        description:
          item.desc ||
          item.description ||
          "",
        cover:
          getCover(item) ||
          item.thumbnail ||
          "",
        country:
          item.country ||
          "",
        status:
          item.status ||
          null,
        lastChapter:
          item.last_chapter ??
          null,
        contentRating:
          item.content_rating ||
          "safe",
        source: "comick"
      }));

    res.json({
      source: "comick",
      query: q,
      count: results.length,
      results
    });

  } catch (error) {
    console.error("Comick search error:", error);

    res.status(502).json({
      error: "Comick search is temporarily unavailable.",
      source: "comick"
    });
  }
});

/* -------------------------------------------------------
   TITLE DETAILS
------------------------------------------------------- */

app.get("/api/source/comick/title/:hid", async (req, res) => {
  const hid = safeText(req.params.hid).trim();

  if (!hid) {
    return res.status(400).json({
      error: "Missing title ID"
    });
  }

  try {
    const data = await fetchJson(
      `${COMICK_API}/comic/${encodeURIComponent(hid)}`
    );

    const comic =
      data?.comic ||
      data?.data?.comic ||
      data;

    res.json({
      source: "comick",
      id: comic.hid || hid,
      hid: comic.hid || hid,
      slug: comic.slug || "",
      title: comic.title || "Unknown title",
      description:
        comic.desc ||
        comic.description ||
        "",
      cover: getCover(comic),
      country: comic.country || "",
      status: comic.status || null,
      year: comic.year || null,
      lastChapter: comic.last_chapter ?? null,
      contentRating:
        comic.content_rating ||
        "safe"
    });

  } catch (error) {
    console.error("Title error:", error);

    res.status(502).json({
      error: "Could not load title.",
      source: "comick"
    });
  }
});

/* -------------------------------------------------------
   CHAPTER LIST
------------------------------------------------------- */

app.get("/api/source/comick/title/:hid/chapters", async (req, res) => {
  const hid = safeText(req.params.hid).trim();

  if (!hid) {
    return res.status(400).json({
      error: "Missing title ID"
    });
  }

  const lang = safeText(req.query.lang) || "en";
  const page = Number(req.query.page || 1);

  try {
    const url =
      `${COMICK_API}/comic/${encodeURIComponent(hid)}/chapters` +
      `?lang=${encodeURIComponent(lang)}` +
      `&page=${page}` +
      `&chap-order=0`;

    const data = await fetchJson(url);

    const raw =
      Array.isArray(data?.chapters)
        ? data.chapters
        : Array.isArray(data)
          ? data
          : [];

    const chapters = raw.map((chapter, index) => ({
      id:
        chapter.hid ||
        chapter.id ||
        `${hid}-${index}`,

      hid:
        chapter.hid ||
        "",

      chapter:
        chapter.chap ??
        "",

      title:
        chapter.title ||
        "",

      volume:
        chapter.vol ??
        null,

      language:
        chapter.lang ||
        lang,

      group:
        Array.isArray(chapter.group_name)
          ? chapter.group_name.join(", ")
          : safeText(chapter.group_name),

      publishedAt:
        chapter.publish_at ||
        chapter.created_at ||
        null
    }));

    res.json({
      source: "comick",
      titleId: hid,
      language: lang,
      page,
      chapters
    });

  } catch (error) {
    console.error("Chapter list error:", error);

    res.status(502).json({
      error: "Could not load chapters.",
      source: "comick"
    });
  }
});

/* -------------------------------------------------------
   CHAPTER PAGES
------------------------------------------------------- */

app.get(
  "/api/source/comick/chapter/:chapterHid",
  async (req, res) => {
    const chapterHid =
      safeText(req.params.chapterHid).trim();

    if (!chapterHid) {
      return res.status(400).json({
        error: "Missing chapter ID"
      });
    }

    try {
      /*
       * Comick's chapter page exposes md_images.
       * We first try the public API.
       */

      let data = null;

      try {
        data = await fetchJson(
          `${COMICK_API}/chapter/${encodeURIComponent(chapterHid)}`
        );
      } catch {
        // Some API versions expose chapter information
        // through the website page instead.
      }

      let images = [];

      const chapter =
        data?.chapter ||
        data?.data?.chapter ||
        data;

      if (Array.isArray(chapter?.md_images)) {
        images = chapter.md_images.map((image, index) => ({
          number: index + 1,
          url: image.url ||
            `${IMAGE_HOST}/${image.b2key}`,
          b2key: image.b2key || ""
        }));
      }

      /*
       * Fallback:
       * fetch the Comick chapter page and read __NEXT_DATA__.
       */

      if (!images.length) {
        const pageUrl =
          `${COMICK_SITE}/comic/${encodeURIComponent(chapterHid)}`;

        try {
          const html = await fetchText(pageUrl);

          const match =
            html.match(
              /<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
            );

          if (match) {
            const nextData =
              JSON.parse(match[1]);

            const pageChapter =
              nextData?.props?.pageProps?.chapter;

            if (
              Array.isArray(
                pageChapter?.md_images
              )
            ) {
              images =
                pageChapter.md_images.map(
                  (image, index) => ({
                    number: index + 1,
                    url:
                      image.url ||
                      `${IMAGE_HOST}/${image.b2key}`,
                    b2key:
                      image.b2key || ""
                  })
                );
            }
          }
        } catch (fallbackError) {
          console.error(
            "Chapter page fallback error:",
            fallbackError.message
          );
        }
      }

      if (!images.length) {
        return res.status(404).json({
          error: "No reader pages were found.",
          chapterId: chapterHid,
          source: "comick"
        });
      }

      res.json({
        source: "comick",
        chapterId: chapterHid,
        pageCount: images.length,
        pages: images
      });

    } catch (error) {
      console.error("Reader error:", error);

      res.status(502).json({
        error: "Could not load reader pages.",
        source: "comick"
      });
    }
  }
);

/* -------------------------------------------------------
   SIMPLE IMAGE PROXY
------------------------------------------------------- */

app.get("/api/image", async (req, res) => {
  const imageUrl = safeText(req.query.url).trim();

  if (!imageUrl) {
    return res.status(400).send("Missing image URL");
  }

  try {
    const parsed = new URL(imageUrl);

    const allowedHosts = [
      "meo.comick.pictures"
    ];

    if (!allowedHosts.includes(parsed.hostname)) {
      return res.status(403).send("Image host not allowed");
    }

    const response = await fetch(imageUrl, {
      headers: {
        Referer: `${COMICK_SITE}/`,
        "User-Agent": USER_AGENT
      }
    });

    if (!response.ok) {
      return res
        .status(response.status)
        .send("Could not load image");
    }

    const contentType =
      response.headers.get("content-type") ||
      "image/jpeg";

    const buffer =
      Buffer.from(await response.arrayBuffer());

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
    console.error("Image proxy error:", error);
    res.status(500).send("Image proxy error");
  }
});

/* -------------------------------------------------------
   OLD DEMO ROUTES
   Kept so your current frontend does not suddenly break.
------------------------------------------------------- */

app.get("/api/title/:id", async (req, res) => {
  const id = req.params.id;

  if (id === "solo-leveling") {
    return res.json({
      id: "solo-leveling",
      title: "Solo Leveling",
      description:
        "Demo compatibility title. Use the Comick source for live data.",
      cover: "",
      source: "demo"
    });
  }

  res.status(404).json({
    error: "Use the Comick source endpoints for live titles."
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

/* -------------------------------------------------------
   Error handler
------------------------------------------------------- */

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    error: "Zyomira backend error"
  });
});

/* -------------------------------------------------------
   Start
------------------------------------------------------- */

app.listen(PORT, () => {
  console.log(
    `Zyomira backend running on port ${PORT}`
  );
});