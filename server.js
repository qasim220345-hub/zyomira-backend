const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/* ===============================
   CORS
================================ */

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});


/* ===============================
   CONFIG
================================ */

const MDX = "https://api.mangadex.org";
const SOURCE = "mangadex";

const MD_HEADERS = {
  "User-Agent": "Zyomira/1.0",
  "Accept": "application/json"
};


/* ===============================
   HOME
================================ */

app.get("/", (req, res) => {
  res.json({
    service: "Zyomira backend",
    status: "online",
    source: SOURCE
  });
});


/* ===============================
   HEALTH
================================ */

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Zyomira backend",
    source: SOURCE
  });
});


/* ===============================
   SEARCH
================================ */

app.get("/api/search", async (req, res) => {

  try {

    const q =
      String(req.query.q || "").trim();

    if (!q) {
      return res.json({
        source: SOURCE,
        query: "",
        count: 0,
        results: []
      });
    }

    const url =
      MDX +
      "/manga?title=" +
      encodeURIComponent(q) +
      "&limit=20" +
      "&includes[]=cover_art" +
      "&includes[]=author" +
      "&includes[]=artist" +
      "&contentRating[]=safe";

    const response =
      await fetch(url, {
        headers: MD_HEADERS
      });

    if (!response.ok) {
      throw new Error(
        "MangaDex search returned " +
        response.status
      );
    }

    const data =
      await response.json();

    const results =
      (data.data || [])
        .map(normalizeManga)
        .filter(Boolean);

    res.json({
      source: SOURCE,
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
      error: "Search failed",
      message: error.message
    });
  }
});


/* ===============================
   DETAILS
================================ */

app.get(
  "/api/source/comix/title/:id",
  async (req, res) => {

    try {

      const id = req.params.id;

      const url =
        MDX +
        "/manga/" +
        encodeURIComponent(id) +
        "?includes[]=cover_art" +
        "&includes[]=author" +
        "&includes[]=artist";

      const response =
        await fetch(url, {
          headers: MD_HEADERS
        });

      if (!response.ok) {
        return res.status(response.status).json({
          error: "Manga not found"
        });
      }

      const data =
        await response.json();

      const manga =
        normalizeManga(data.data);

      if (
        !manga ||
        manga.content_rating !== "safe"
      ) {
        return res.status(404).json({
          error: "Manga not available"
        });
      }

      res.json(manga);

    } catch (error) {

      console.error(
        "Details error:",
        error
      );

      res.status(500).json({
        error: "Could not load manga",
        message: error.message
      });
    }
  }
);


/* ===============================
   CHAPTERS
================================ */

app.get(
  "/api/source/comix/title/:id/chapters",
  async (req, res) => {

    try {

      const id = req.params.id;

      const url =
        MDX +
        "/manga/" +
        encodeURIComponent(id) +
        "/feed" +
        "?translatedLanguage[]=en" +
        "&order[chapter]=desc" +
        "&order[volume]=desc" +
        "&limit=100" +
        "&includes[]=scanlation_group";

      const response =
        await fetch(url, {
          headers: MD_HEADERS
        });

      if (!response.ok) {
        throw new Error(
          "MangaDex chapters returned " +
          response.status
        );
      }

      const data =
        await response.json();

      const chapters =
        (data.data || [])
          .map(chapter => {

            const attributes =
              chapter.attributes || {};

            return {
              id: chapter.id,

              chapter:
                attributes.chapter || "",

              volume:
                attributes.volume || "",

              title:
                attributes.title || "",

              pages:
                attributes.pages || 0,

              published:
                attributes.publishAt || "",

              translatedLanguage:
                attributes.translatedLanguage ||
                "en",

              source: SOURCE
            };

          });

      res.json({
        source: SOURCE,
        mangaId: id,
        count: chapters.length,
        chapters
      });

    } catch (error) {

      console.error(
        "Chapters error:",
        error
      );

      res.status(500).json({
        error: "Could not load chapters",
        message: error.message
      });
    }
  }
);


/* ===============================
   READER
================================ */

app.get(
  "/api/source/comix/chapter/:chapterId",
  async (req, res) => {

    try {

      const chapterId =
        req.params.chapterId;

      const url =
        MDX +
        "/at-home/server/" +
        encodeURIComponent(chapterId);

      console.log(
        "Reader request:",
        chapterId
      );

      const response =
        await fetch(url, {
          headers: MD_HEADERS
        });

      const text =
        await response.text();

      console.log(
        "MangaDex reader status:",
        response.status
      );

      if (!response.ok) {

        console.error(
          "MangaDex response:",
          text.slice(0, 1000)
        );

        return res.status(502).json({
          error:
            "MangaDex rejected the reader request",

          mangaDexStatus:
            response.status
        });
      }

      let data;

      try {

        data =
          JSON.parse(text);

      } catch (error) {

        console.error(
          "MangaDex returned non-JSON:",
          text.slice(0, 1000)
        );

        return res.status(502).json({
          error:
            "MangaDex returned an invalid response"
        });
      }


      /*
       * MangaDex @at-home/server normally returns:
       *
       * {
       *   baseUrl: "...",
       *   chapter: {
       *     hash: "...",
       *     data: [...]
       *   }
       * }
       *
       * Some responses can contain dataSaver instead.
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
          "Unexpected MangaDex response:"
        );

        console.error(
          JSON.stringify(
            data,
            null,
            2
          ).slice(0, 5000)
        );

        return res.status(502).json({
          error:
            "MangaDex returned no chapter information",

          responseKeys:
            Object.keys(data || {}),

          hasBaseUrl:
            Boolean(baseUrl),

          hasChapter:
            Boolean(chapter)
        });
      }


      const hash =
        chapter.hash ||
        "";

      const normalPages =
        Array.isArray(chapter.data)
          ? chapter.data
          : [];

      const saverPages =
        Array.isArray(chapter.dataSaver)
          ? chapter.dataSaver
          : [];


      /*
       * Use normal-quality pages first.
       * Fall back to dataSaver if necessary.
       */

      const filenames =
        normalPages.length
          ? normalPages
          : saverPages;


      if (!hash || !filenames.length) {

        console.error(
          "Chapter exists but contains no pages."
        );

        return res.status(502).json({
          error:
            "MangaDex chapter contains no pages",

          hasHash:
            Boolean(hash),

          normalPageCount:
            normalPages.length,

          dataSaverPageCount:
            saverPages.length
        });
      }


      const pages =
        filenames.map(
          filename =>
            baseUrl +
            "/data/" +
            hash +
            "/" +
            filename
        );


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

      console.error(
        "Reader error:",
        error
      );

      res.status(500).json({
        error:
          "Could not load chapter",

        message:
          error.message
      });
    }
  }
);


/* ===============================
   IMAGE PROXY
================================ */

app.get("/api/image", async (req, res) => {

  try {

    const imageUrl =
      req.query.url;

    if (!imageUrl) {
      return res.status(400).json({
        error: "Missing image URL"
      });
    }

    const response =
      await fetch(imageUrl, {
        headers: {
          "User-Agent":
            "Zyomira/1.0",

          "Accept":
            "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
        }
      });

    if (!response.ok) {
      return res.status(response.status).send(
        "Image request failed"
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
      "public, max-age=86400"
    );

    res.send(buffer);

  } catch (error) {

    console.error(
      "Image error:",
      error
    );

    res.status(500).send(
      "Could not load image"
    );
  }
});


/* ===============================
   SOURCES
================================ */

app.get("/api/sources", (req, res) => {

  res.json({
    sources: [
      {
        id: "mangadex",
        name: "MangaDex",
        type: "manga",
        enabled: true
      }
    ]
  });

});


/* ===============================
   REPOSITORY
================================ */

app.get("/api/repository", (req, res) => {

  res.json({
    name: "Zyomira Sources",

    version: "1.0.0",

    sources: [
      {
        id: "mangadex",
        name: "MangaDex",
        type: "manga",
        enabled: true
      }
    ]
  });

});


/* ===============================
   NORMALIZE
================================ */

function normalizeManga(item) {

  if (
    !item ||
    !item.id ||
    !item.attributes
  ) {
    return null;
  }

  const attributes =
    item.attributes;

  if (
    attributes.contentRating !== "safe"
  ) {
    return null;
  }

  const title =
    attributes.title?.en ||
    Object.values(
      attributes.title || {}
    )[0] ||
    "Unknown title";

  const description =
    attributes.description?.en ||
    Object.values(
      attributes.description || {}
    )[0] ||
    "";

  let cover = "";

  const coverArt =
    (item.relationships || [])
      .find(
        relationship =>
          relationship.type ===
          "cover_art"
      );

  if (
    coverArt &&
    coverArt.attributes?.fileName
  ) {

    cover =
      "https://uploads.mangadex.org/covers/" +
      item.id +
      "/" +
      coverArt.attributes.fileName;
  }

  const author =
    (item.relationships || [])
      .find(
        relationship =>
          relationship.type ===
          "author"
      )
      ?.attributes?.name || "";

  const artist =
    (item.relationships || [])
      .find(
        relationship =>
          relationship.type ===
          "artist"
      )
      ?.attributes?.name || "";

  return {

    id: item.id,

    title,

    description,

    synopsis: description,

    cover,

    thumbnail: cover,

    author,

    artist,

    status:
      attributes.status || "",

    year:
      attributes.year || "",

    type: "manga",

    content_rating:
      attributes.contentRating ||
      "safe",

    source: SOURCE
  };
}


/* ===============================
   START
================================ */

app.listen(PORT, () => {

  console.log(
    `Zyomira backend running on port ${PORT}`
  );

});