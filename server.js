const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const COMICK_API = "https://comick.io";
const IMAGE_HOST = "https://meo.comick.pictures";

const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36";

/* ---------------- HELPERS ---------------- */

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

function text(value) {
  return typeof value === "string" ? value : "";
}

function cover(item) {
  if (!item) return "";

  if (Array.isArray(item.md_covers) && item.md_covers.length) {
    const c = item.md_covers[0];

    if (c.b2key) {
      return `${IMAGE_HOST}/${c.b2key}`;
    }
  }

  return item.thumbnail || "";
}

/* ---------------- HOME ---------------- */

app.get("/", (req, res) => {
  res.json({
    service: "Zyomira backend",
    version: "2.1.0",
    status: "online"
  });
});

/* ---------------- HEALTH ---------------- */

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Zyomira backend",
    version: "2.1.0"
  });
});

/* ---------------- SOURCES ---------------- */

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

/* ---------------- SEARCH ---------------- */

app.get("/api/search", async (req, res) => {
  const q = text(req.query.q).trim();

  if (!q) {
    return res.json({
      source: "comick",
      query: "",
      count: 0,
      results: []
    });
  }

  try {
    /*
      Current Comick endpoint:
      /api/v1.0/search
    */

    const url =
      `${COMICK_API}/api/v1.0/search` +
      `?q=${encodeURIComponent(q)}` +
      `&limit=20` +
      `&page=1` +
      `&content_rating=safe`;

    const data = await fetchJson(url);

    const raw =
      Array.isArray(data)
        ? data
        : Array.isArray(data.comics)
          ? data.comics
          : Array.isArray(data.results)
            ? data.results
            : [];

    const results = raw
      .filter(item => {
        const rating =
          item.content_rating ||
          "safe";

        return rating !== "pornographic";
      })
      .map((item, index) => ({
        id:
          item.hid ||
          item.id ||
          `comick-${index}`,

        hid:
          item.hid ||
          "",

        slug:
          item.slug ||
          "",

        title:
          item.title ||
          item.name ||
          "Unknown title",

        description:
          item.desc ||
          item.description ||
          "",

        cover:
          cover(item),

        thumbnail:
          item.thumbnail ||
          cover(item),

        country:
          item.country ||
          "",

        status:
          item.status ??
          null,

        year:
          item.year ??
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
    console.error(
      "Comick search error:",
      error.message
    );

    res.status(502).json({
      error: "Comick search is temporarily unavailable.",
      source: "comick",
      details: error.message
    });
  }
});

/* ---------------- TITLE ---------------- */

app.get("/api/source/comick/title/:hid", async (req, res) => {
  const hid = text(req.params.hid).trim();

  if (!hid) {
    return res.status(400).json({
      error: "Missing title ID"
    });
  }

  try {
    const data = await fetchJson(
      `${COMICK_API}/api/comic/${encodeURIComponent(hid)}`
    );

    const comic =
      data?.comic ||
      data?.data?.comic ||
      data;

    res.json({
      source: "comick",

      id:
        comic.hid ||
        hid,

      hid:
        comic.hid ||
        hid,

      slug:
        comic.slug ||
        "",

      title:
        comic.title ||
        "Unknown title",

      description:
        comic.desc ||
        comic.description ||
        "",

      cover:
        cover(comic),

      country:
        comic.country ||
        "",

      status:
        comic.status ??
        null,

      year:
        comic.year ??
        null,

      lastChapter:
        comic.last_chapter ??
        null,

      contentRating:
        comic.content_rating ||
        "safe"
    });

  } catch (error) {
    console.error(
      "Title error:",
      error.message
    );

    res.status(502).json({
      error: "Could not load title.",
      source: "comick"
    });
  }
});

/* ---------------- CHAPTERS ---------------- */

app.get(
  "/api/source/comick/title/:hid/chapters",
  async (req, res) => {

    const hid = text(req.params.hid).trim();

    if (!hid) {
      return res.status(400).json({
        error: "Missing title ID"
      });
    }

    const lang =
      text(req.query.lang) ||
      "en";

    const page =
      Number(req.query.page || 1);

    try {
      const url =
        `${COMICK_API}/api/comic/` +
        `${encodeURIComponent(hid)}/chapters` +
        `?lang=${encodeURIComponent(lang)}` +
        `&page=${page}` +
        `&chap-order=0` +
        `&limit=100`;

      const data =
        await fetchJson(url);

      const raw =
        Array.isArray(data)
          ? data
          : Array.isArray(data.chapters)
            ? data.chapters
            : [];

      const chapters =
        raw.map((chapter, index) => ({
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
            Array.isArray(
              chapter.group_name
            )
              ? chapter.group_name.join(", ")
              : text(chapter.group_name),

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
      console.error(
        "Chapter error:",
        error.message
      );

      res.status(502).json({
        error: "Could not load chapters.",
        source: "comick"
      });
    }
  }
);

/* ---------------- CHAPTER PAGES ---------------- */

app.get(
  "/api/source/comick/chapter/:hid",
  async (req, res) => {

    const hid =
      text(req.params.hid).trim();

    if (!hid) {
      return res.status(400).json({
        error: "Missing chapter ID"
      });
    }

    try {
      const data = await fetchJson(
        `${COMICK_API}/api/chapter/${encodeURIComponent(hid)}`
      );

      const chapter =
        data?.chapter ||
        data?.data?.chapter ||
        data;

      let pages = [];

      if (
        Array.isArray(
          chapter?.md_images
        )
      ) {
        pages =
          chapter.md_images.map(
            (image, index) => ({
              number: index + 1,

              url:
                image.url ||
                `${IMAGE_HOST}/${image.b2key}`,

              b2key:
                image.b2key ||
                ""
            })
          );
      }

      /*
        Some API responses expose the
        image URLs directly.
      */

      if (
        !pages.length &&
        Array.isArray(data?.pages)
      ) {
        pages =
          data.pages.map(
            (url, index) => ({
              number: index + 1,
              url:
                typeof url === "string"
                  ? url
                  : url.url || "",
              b2key: ""
            })
          );
      }

      if (!pages.length) {
        return res.status(404).json({
          error:
            "No reader pages were found.",
          chapterId: hid,
          source: "comick"
        });
      }

      res.json({
        source: "comick",
        chapterId: hid,
        pageCount: pages.length,
        pages
      });

    } catch (error) {
      console.error(
        "Reader error:",
        error.message
      );

      res.status(502).json({
        error:
          "Could not load reader pages.",
        source: "comick"
      });
    }
  }
);

/* ---------------- IMAGE PROXY ---------------- */

app.get("/api/image", async (req, res) => {
  const imageUrl =
    text(req.query.url).trim();

  if (!imageUrl) {
    return res.status(400).send(
      "Missing image URL"
    );
  }

  try {
    const parsed =
      new URL(imageUrl);

    if (
      parsed.hostname !==
      "meo.comick.pictures"
    ) {
      return res.status(403).send(
        "Image host not allowed"
      );
    }

    const response =
      await fetch(imageUrl, {
        headers: {
          Referer: `${COMICK_API}/`,
          "User-Agent": USER_AGENT
        }
      });

    if (!response.ok) {
      return res.status(
        response.status
      ).send(
        "Could not load image"
      );
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
      error.message
    );

    res.status(500).send(
      "Image proxy error"
    );
  }
});

/* ---------------- OLD COMPATIBILITY ROUTES ---------------- */

app.get("/api/title/:id", (req, res) => {
  res.status(410).json({
    error:
      "This is an old demo endpoint. Use /api/source/comick/title/:hid"
  });
});

app.get("/api/title/:id/chapters", (req, res) => {
  res.status(410).json({
    error:
      "Use the Comick chapter endpoint."
  });
});

app.get(
  "/api/title/:id/chapter/:chapter",
  (req, res) => {
    res.status(410).json({
      error:
        "Use the Comick reader endpoint."
    });
  }
);

/* ---------------- ERROR HANDLER ---------------- */

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    error: "Zyomira backend error"
  });
});

/* ---------------- START ---------------- */

app.listen(PORT, () => {
  console.log(
    `Zyomira backend running on port ${PORT}`
  );
});