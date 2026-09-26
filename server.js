const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const COMICK_PROXY =
  "https://comick-api-proxy.notaspider.dev/api/v1.0";

const IMAGE_HOST =
  "https://meo.comick.pictures/";

// --------------------------------------------------
// Helpers
// --------------------------------------------------

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.text();
}


async function fetchJSON(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Zyomira/1.0",
      "Accept": "application/json"
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
    throw new Error(
      data?.error ||
      data?.message ||
      `HTTP ${response.status}`
    );
  }

  return data;
}


// --------------------------------------------------
// Extract Next.js page data
// --------------------------------------------------

function extractNextData(html) {
  const match = html.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
  );

  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}


// --------------------------------------------------
// Extract images from chapter data
// --------------------------------------------------

function extractChapterImages(chapter) {
  const images =
    chapter?.md_images ||
    chapter?.images ||
    [];

  if (!Array.isArray(images)) {
    return [];
  }

  return images
    .map((image, index) => {
      if (!image) return null;

      if (typeof image === "string") {
        return {
          index,
          url: image.startsWith("http")
            ? image
            : IMAGE_HOST + image.replace(/^\/+/, "")
        };
      }

      if (image.b2key) {
        return {
          index,
          url:
            IMAGE_HOST +
            image.b2key
        };
      }

      if (image.url) {
        return {
          index,
          url: image.url
        };
      }

      return null;
    })
    .filter(Boolean);
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
    const data = await fetchJSON(
      COMICK_PROXY +
      "/search?q=" +
      encodeURIComponent(q)
    );

    const list =
      Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
          ? data.results
          : [];

    const results = list
      .filter(
        item =>
          String(
            item?.content_rating || ""
          ).toLowerCase() !==
          "pornographic"
      )
      .map(item => ({
        id:
          item?.hid ||
          item?.id ||
          null,

        hid:
          item?.hid ||
          null,

        slug:
          item?.slug ||
          null,

        title:
          item?.title ||
          "Unknown title",

        description:
          item?.description ||
          item?.desc ||
          "",

        cover:
          item?.md_covers?.[0]?.b2key
            ? IMAGE_HOST +
              item.md_covers[0].b2key
            : item?.cover ||
              item?.cover_url ||
              null,

        thumbnail:
          item?.md_covers?.[0]?.b2key
            ? IMAGE_HOST +
              item.md_covers[0].b2key
            : item?.thumbnail ||
              null,

        country:
          item?.country ||
          null,

        status:
          item?.status ||
          null,

        year:
          item?.year ||
          null,

        lastChapter:
          item?.last_chapter ??
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
    console.error(
      "Search error:",
      error
    );

    res.status(500).json({
      error:
        "Comick search failed.",
      details:
        error.message
    });
  }
});


// --------------------------------------------------
// Manga details
// --------------------------------------------------

app.get(
  "/api/source/comick/title/:hid",
  async (req, res) => {
    try {
      const data =
        await fetchJSON(
          COMICK_PROXY +
          "/comic/" +
          encodeURIComponent(
            req.params.hid
          )
        );

      res.json(data);

    } catch (error) {
      console.error(
        "Details error:",
        error
      );

      res.status(500).json({
        error:
          "Could not load manga details.",
        details:
          error.message
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
    try {
      const lang =
        String(
          req.query.lang || "en"
        );

      const page =
        Number(
          req.query.page || 1
        );

      const url =
        COMICK_PROXY +
        "/comic/" +
        encodeURIComponent(
          req.params.hid
        ) +
        "/chapters?lang=" +
        encodeURIComponent(lang) +
        "&page=" +
        page;

      const data =
        await fetchJSON(url);

      res.json(data);

    } catch (error) {
      console.error(
        "Chapter list error:",
        error
      );

      res.status(500).json({
        error:
          "Could not load chapters.",
        details:
          error.message
      });
    }
  }
);


// --------------------------------------------------
// Chapter metadata
// --------------------------------------------------

app.get(
  "/api/source/comick/chapter/:chapterHid",
  async (req, res) => {
    try {
      const data =
        await fetchJSON(
          COMICK_PROXY +
          "/chapter/" +
          encodeURIComponent(
            req.params.chapterHid
          )
        );

      res.json({
        ...data,
        pages:
          extractChapterImages(
            data?.chapter ||
            data
          )
      });

    } catch (error) {
      console.error(
        "Chapter error:",
        error
      );

      res.status(500).json({
        error:
          "Could not load chapter.",
        details:
          error.message,
        pages: []
      });
    }
  }
);


// --------------------------------------------------
// REAL CHAPTER PAGES
//
// Required query parameters:
//
// ?slug=00-solo-leveling
// &chap=200.5
// &lang=en
//
// Example:
//
// /api/source/comick/chapter/5N_wGCXG/pages
// ?slug=00-solo-leveling
// &chap=200.5
// &lang=en
// --------------------------------------------------

app.get(
  "/api/source/comick/chapter/:chapterHid/pages",
  async (req, res) => {

    const chapterHid =
      req.params.chapterHid;

    const slug =
      String(
        req.query.slug || ""
      ).trim();

    const chap =
      String(
        req.query.chap || ""
      ).trim();

    const lang =
      String(
        req.query.lang || "en"
      ).trim();

    if (!slug || !chap) {
      return res.status(400).json({
        error:
          "slug and chap are required.",
        example:
          `/api/source/comick/chapter/${chapterHid}/pages?slug=00-solo-leveling&chap=200.5&lang=en`
      });
    }

    try {

      /*
       * Comick chapter pages use:
       *
       * /comic/{slug}/{hid}-chapter-{chapter}-{lang}
       */

      const chapterPath =
        `${chapterHid}-chapter-${chap}-${lang}`;

      const url =
        `https://comick.io/comic/${encodeURIComponent(slug)}/${encodeURIComponent(chapterPath)}`;

      console.log(
        "Fetching chapter page:",
        url
      );

      const html =
        await fetchText(url);

      const nextData =
        extractNextData(html);

      if (!nextData) {
        return res.status(502).json({
          error:
            "Comick chapter page did not contain Next.js data.",
          chapterHid,
          pages: []
        });
      }

      const pageProps =
        nextData?.props?.pageProps ||
        {};

      const chapter =
        pageProps.chapter ||
        pageProps?.data?.chapter ||
        null;

      if (!chapter) {
        return res.status(404).json({
          error:
            "Chapter data was not found.",
          chapterHid,
          pages: []
        });
      }

      const pages =
        extractChapterImages(
          chapter
        );

      if (!pages.length) {
        return res.status(404).json({
          error:
            "Chapter was found, but it contains no page images.",
          chapterHid,
          slug,
          chap,
          lang,
          pages: []
        });
      }

      res.json({
        source: "comick",
        chapterHid,
        slug,
        chap,
        lang,
        count: pages.length,
        pages
      });

    } catch (error) {

      console.error(
        "Page extraction error:",
        error
      );

      res.status(500).json({
        error:
          "Could not retrieve chapter pages.",
        chapterHid,
        details:
          error.message,
        pages: []
      });
    }
  }
);


// --------------------------------------------------
// Image proxy
// --------------------------------------------------

app.get(
  "/api/image",
  async (req, res) => {

    const imageUrl =
      String(
        req.query.url || ""
      ).trim();

    if (!imageUrl) {
      return res.status(400).json({
        error:
          "Image URL is required."
      });
    }

    try {

      const response =
        await fetch(imageUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0",
            "Referer":
              "https://comick.io/"
          }
        });

      if (!response.ok) {
        return res.status(
          response.status
        ).json({
          error:
            "Image request failed."
        });
      }

      const buffer =
        Buffer.from(
          await response.arrayBuffer()
        );

      res.setHeader(
        "Content-Type",
        response.headers.get(
          "content-type"
        ) || "image/jpeg"
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
          "Could not load image.",
        details:
          error.message
      });
    }
  }
);


// --------------------------------------------------
// Repository
// --------------------------------------------------

app.get(
  "/api/repository",
  (req, res) => {
    res.json({
      name:
        "Zyomira Repository",
      version: 1,
      extensions: []
    });
  }
);


// --------------------------------------------------
// Sources
// --------------------------------------------------

app.get(
  "/api/sources",
  (req, res) => {
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
  }
);


// --------------------------------------------------
// Start
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(
    `Zyomira backend running on port ${PORT}`
  );
});