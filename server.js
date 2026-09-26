const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const COMIX_API = "https://comix-api.vercel.app/api";


// ==================================================
// HELPERS
// ==================================================

async function fetchJSON(url) {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Zyomira/1.0"
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


function absoluteImage(url) {
  if (!url) return null;

  if (url.startsWith("http://") ||
      url.startsWith("https://")) {
    return url;
  }

  return "https://comix-api.vercel.app" +
    (url.startsWith("/") ? url : "/" + url);
}


// ==================================================
// HOME
// ==================================================

app.get("/", (req, res) => {
  res.json({
    service: "Zyomira backend",
    source: "Comix",
    status: "online"
  });
});


// ==================================================
// HEALTH
// ==================================================

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Zyomira backend",
    source: "comix"
  });
});


// ==================================================
// COMIX HOME
// ==================================================

app.get("/api/comix/home", async (req, res) => {
  try {
    const data = await fetchJSON(
      `${COMIX_API}/manga/home?sfw=true`
    );

    res.json(data);

  } catch (error) {
    console.error("Comix home error:", error);

    res.status(500).json({
      error: "Could not load Comix home.",
      details: error.message
    });
  }
});


// ==================================================
// SEARCH
// ==================================================

app.get("/api/search", async (req, res) => {
  const q = String(req.query.q || "").trim();

  if (!q) {
    return res.status(400).json({
      error: "Search query is required."
    });
  }

  try {
    const data = await fetchJSON(
      `${COMIX_API}/manga/search?q=${encodeURIComponent(q)}&sfw=true`
    );

    const items =
      Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
          ? data
          : [];

    const results = items.map(item => ({
      id: item.id,
      hid: item.id,

      slug: item.id,

      title:
        item.title ||
        "Unknown title",

      description:
        item.description ||
        item.synopsis ||
        "",

      cover:
        absoluteImage(
          item.cover ||
          item.img
        ),

      thumbnail:
        absoluteImage(
          item.cover ||
          item.img
        ),

      status:
        item.status ??
        null,

      score:
        item.score ??
        null,

      type:
        item.type ||
        "manga",

      source:
        "comix"
    }));

    res.json({
      source: "comix",
      query: q,
      count: results.length,
      results
    });

  } catch (error) {
    console.error("Comix search error:", error);

    res.status(500).json({
      error: "Comix search failed.",
      source: "comix",
      details: error.message
    });
  }
});


// ==================================================
// DETAILS
// ==================================================

app.get(
  "/api/source/comix/title/:id",
  async (req, res) => {

    const id = req.params.id;

    try {
      const data = await fetchJSON(
        `${COMIX_API}/manga/${encodeURIComponent(id)}?sfw=true`
      );

      const comic =
        data?.comic ||
        data?.manga ||
        data;

      res.json({
        ...data,

        source: "comix",

        comic: {
          ...comic,

          id:
            comic?.id ||
            id,

          title:
            comic?.title ||
            "Unknown title",

          cover:
            absoluteImage(
              comic?.cover ||
              comic?.img
            ),

          synopsis:
            comic?.synopsis ||
            comic?.description ||
            "",

          type:
            comic?.type ||
            "manga"
        }
      });

    } catch (error) {
      console.error(
        "Comix details error:",
        error
      );

      res.status(500).json({
        error:
          "Could not load Comix manga details.",
        details:
          error.message
      });
    }
  }
);


// ==================================================
// CHAPTERS
// ==================================================

app.get(
  "/api/source/comix/title/:id/chapters",
  async (req, res) => {

    const id = req.params.id;

    const page =
      Number(req.query.page || 1);

    const limit =
      Number(req.query.limit || 100);

    try {
      const data = await fetchJSON(
        `${COMIX_API}/manga/${encodeURIComponent(id)}/chapters?page=${page}&limit=${limit}`
      );

      const chapters =
        Array.isArray(data?.chapters)
          ? data.chapters
          : Array.isArray(data?.results)
            ? data.results
            : Array.isArray(data)
              ? data
              : [];

      const normalized =
        chapters.map(chapter => ({
          id:
            String(
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
            null,

          uploadedAt:
            chapter.uploaded_at ||
            chapter.created_at ||
            null,

          source:
            "comix"
        }));

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
        "Comix chapters error:",
        error
      );

      res.status(500).json({
        error:
          "Could not load Comix chapters.",
        details:
          error.message,
        chapters: []
      });
    }
  }
);


// ==================================================
// READ CHAPTER
// ==================================================

app.get(
  "/api/source/comix/chapter/:chapterId",
  async (req, res) => {

    const chapterId =
      req.params.chapterId;

    try {
      const data = await fetchJSON(
        `${COMIX_API}/manga/read?chapterId=${encodeURIComponent(chapterId)}`
      );

      const rawImages =
        Array.isArray(data?.images)
          ? data.images
          : [];

      const pages =
        rawImages
          .map((image, index) => {

            const url =
              image?.url ||
              image?.src ||
              image;

            if (!url) {
              return null;
            }

            return {
              index,

              url:
                absoluteImage(
                  url
                ),

              width:
                image?.width ||
                null,

              height:
                image?.height ||
                null
            };
          })
          .filter(Boolean);

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

        count:
          pages.length,

        total_images:
          data?.total_images ??
          pages.length,

        pages
      });

    } catch (error) {
      console.error(
        "Comix reader error:",
        error
      );

      res.status(500).json({
        error:
          "Could not load Comix chapter images.",
        chapterId,
        pages: [],
        details:
          error.message
      });
    }
  }
);


// ==================================================
// GENERIC IMAGE PROXY
// ==================================================

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
              "Mozilla/5.0 Zyomira/1.0",
            "Referer":
              "https://comix.to/"
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
        ) ||
        "image/jpeg"
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


// ==================================================
// SOURCE LIST
// ==================================================

app.get(
  "/api/sources",
  (req, res) => {

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
        },

        {
          id: "comick",
          name: "Comick",
          enabled: false,
          search: true,
          details: true,
          chapters: true,
          reader: false,

          types: [
            "manga",
            "manhwa",
            "manhua"
          ]
        }
      ]
    });
  }
);


// ==================================================
// REPOSITORY
// ==================================================

app.get(
  "/api/repository",
  (req, res) => {

    res.json({
      name:
        "Zyomira Repository",

      version:
        2,

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

          reader:
            true,

          enabled:
            true
        }
      ]
    });
  }
);


// ==================================================
// START
// ==================================================

app.listen(PORT, () => {
  console.log(
    `Zyomira backend running on port ${PORT}`
  );
});