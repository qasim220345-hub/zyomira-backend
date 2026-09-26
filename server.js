const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const MDX = "https://api.mangadex.org";
const SOURCE = "mangadex";

/* ---------------- HELPERS ---------------- */

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
      `MangaDex returned invalid JSON (${response.status})`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.errors?.[0]?.detail ||
      data?.message ||
      `MangaDex HTTP ${response.status}`
    );
  }

  return data;
}

function textValue(value) {
  if (!value) return "";

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    return (
      value.en ||
      Object.values(value)[0] ||
      ""
    );
  }

  return String(value);
}

function getTitle(attributes) {
  const title = attributes?.title;

  return (
    textValue(title) ||
    "Unknown title"
  );
}

function getDescription(attributes) {
  const description =
    attributes?.description;

  return textValue(description);
}

function getCover(manga) {
  const relationships =
    manga.relationships || [];

  const cover = relationships.find(
    (rel) => rel.type === "cover_art"
  );

  if (!cover?.id) return "";

  const fileName =
    cover.attributes?.fileName;

  if (!fileName) return "";

  return (
    `https://uploads.mangadex.org/covers/` +
    `${manga.id}/${fileName}`
  );
}

function getAuthor(manga) {
  const relationships =
    manga.relationships || [];

  const author = relationships.find(
    (rel) => rel.type === "author"
  );

  return (
    author?.attributes?.name ||
    ""
  );
}

function getArtist(manga) {
  const relationships =
    manga.relationships || [];

  const artist = relationships.find(
    (rel) => rel.type === "artist"
  );

  return (
    artist?.attributes?.name ||
    ""
  );
}

/*
  Zyomira only shows safe-rated titles.
  This prevents the source's adult-rated entries
  from being exposed by the app.
*/
function isSafeManga(manga) {
  const rating =
    manga?.attributes?.contentRating;

  return rating === "safe";
}

/* ---------------- HOME ---------------- */

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Zyomira backend",
    source: SOURCE
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Zyomira backend",
    source: SOURCE
  });
});

/* ---------------- SEARCH ---------------- */

app.get("/api/search", async (req, res) => {
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

  try {
    const params = new URLSearchParams();

    params.set("title", q);
    params.set("limit", "20");

    /*
      Ask MangaDex to include cover information.
    */
    params.append(
      "includes[]",
      "cover_art"
    );

    params.append(
      "includes[]",
      "author"
    );

    params.append(
      "includes[]",
      "artist"
    );

    /*
      Only safe-rated manga.
    */
    params.append(
      "contentRating[]",
      "safe"
    );

    const data = await fetchJSON(
      `${MDX}/manga?${params.toString()}`
    );

    const mangaList =
      Array.isArray(data?.data)
        ? data.data
        : [];

    const results =
      mangaList.map((manga) => {
        const attributes =
          manga.attributes || {};

        return {
          id: manga.id,
          hid: manga.id,
          slug: manga.id,

          title:
            getTitle(attributes),

          description:
            getDescription(attributes),

          synopsis:
            getDescription(attributes),

          cover:
            getCover(manga),

          thumbnail:
            getCover(manga),

          author:
            getAuthor(manga),

          artist:
            getArtist(manga),

          status:
            attributes.status || null,

          year:
            attributes.year || null,

          type: "manga",

          content_rating:
            attributes.contentRating ||
            "safe",

          source: SOURCE
        };
      });

    res.json({
      source: SOURCE,
      query: q,
      count: results.length,
      results
    });

  } catch (error) {
    console.error(
      "SEARCH ERROR:",
      error.message
    );

    res.status(502).json({
      source: SOURCE,
      query: q,
      count: 0,
      results: [],
      error: "MangaDex search failed.",
      details: error.message
    });
  }
});

/* ---------------- DETAILS ---------------- */

app.get(
  "/api/source/comix/title/:id",
  async (req, res) => {
    try {
      const id = req.params.id;

      const params = new URLSearchParams();

      params.append(
        "includes[]",
        "cover_art"
      );

      params.append(
        "includes[]",
        "author"
      );

      params.append(
        "includes[]",
        "artist"
      );

      const data = await fetchJSON(
        `${MDX}/manga/${encodeURIComponent(id)}?${params.toString()}`
      );

      const manga = data?.data;

      if (!manga) {
        return res.status(404).json({
          error: "Manga not found."
        });
      }

      if (!isSafeManga(manga)) {
        return res.status(403).json({
          error: "This title is not available."
        });
      }

      const attributes =
        manga.attributes || {};

      res.json({
        source: SOURCE,

        id: manga.id,

        title:
          getTitle(attributes),

        description:
          getDescription(attributes),

        synopsis:
          getDescription(attributes),

        cover:
          getCover(manga),

        thumbnail:
          getCover(manga),

        author:
          getAuthor(manga),

        artist:
          getArtist(manga),

        status:
          attributes.status || null,

        year:
          attributes.year || null,

        genres:
          Array.isArray(attributes.tags)
            ? attributes.tags
                .map(
                  (tag) =>
                    textValue(
                      tag?.attributes?.name
                    )
                )
                .filter(Boolean)
            : [],

        type: "manga",

        content_rating:
          attributes.contentRating ||
          "safe"
      });

    } catch (error) {
      console.error(
        "DETAIL ERROR:",
        error.message
      );

      res.status(502).json({
        error:
          "Could not load manga details.",
        details: error.message
      });
    }
  }
);

/* ---------------- CHAPTERS ---------------- */

app.get(
  "/api/source/comix/title/:id/chapters",
  async (req, res) => {
    try {
      const mangaId =
        req.params.id;

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

      const offset =
        (page - 1) * limit;

      const params =
        new URLSearchParams();

      params.set(
        "limit",
        String(limit)
      );

      params.set(
        "offset",
        String(offset)
      );

      /*
        English chapters only.
      */
      params.append(
        "translatedLanguage[]",
        "en"
      );

      /*
        Newest chapters first.
      */
      params.set(
        "order[publishAt]",
        "desc"
      );

      /*
        Include the scanlation group.
      */
      params.append(
        "includes[]",
        "scanlation_group"
      );

      const data = await fetchJSON(
        `${MDX}/manga/${encodeURIComponent(mangaId)}/feed?${params.toString()}`
      );

      const chapters =
        Array.isArray(data?.data)
          ? data.data
          : [];

      const normalized =
        chapters
          .map((chapter) => {
            const attributes =
              chapter.attributes || {};

            const group =
              (chapter.relationships || [])
                .find(
                  (rel) =>
                    rel.type ===
                    "scanlation_group"
                );

            return {
              id: chapter.id,

              chapter:
                attributes.chapter ??
                "",

              number:
                attributes.chapter ??
                "",

              title:
                attributes.title ||
                "",

              volume:
                attributes.volume ??
                null,

              scanlationGroup:
                group?.attributes?.name ||
                null,

              uploadedAt:
                attributes.publishAt ||
                null,

              language:
                attributes.translatedLanguage ||
                "en",

              pages:
                attributes.pages ||
                0,

              source: SOURCE
            };
          })
          .filter(
            (chapter) =>
              chapter.id
          );

      res.json({
        source: SOURCE,
        mangaId,
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
        error:
          "Could not load chapters.",
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
        req.params.chapterId;

      /*
        MangaDex@Home provides the actual
        page server and filenames.
      */
      const data = await fetchJSON(
        `${MDX}/at-home/server/${encodeURIComponent(chapterId)}`
      );

      if (
        data?.result !== "ok" ||
        !data?.baseUrl ||
        !data?.chapter
      ) {
        return res.status(404).json({
          error:
            "MangaDex did not provide chapter pages.",
          chapterId,
          pages: []
        });
      }

      const baseUrl =
        data.baseUrl;

      const hash =
        data.chapter.hash;

      /*
        Use the normal image quality.
      */
      const files =
        Array.isArray(
          data.chapter.data
        )
          ? data.chapter.data
          : [];

      const pages =
        files.map(
          (fileName, index) => ({
            index,

            url:
              `${baseUrl}/data/` +
              `${hash}/` +
              `${fileName}`,

            width: null,
            height: null
          })
        );

      if (!pages.length) {
        return res.status(404).json({
          error:
            "This chapter has no readable pages.",
          chapterId,
          pages: []
        });
      }

      res.json({
        source: SOURCE,
        chapterId,
        count: pages.length,
        total_images: pages.length,
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
        chapterId:
          req.params.chapterId,
        pages: [],
        details: error.message
      });
    }
  }
);

/* ---------------- IMAGE PROXY ---------------- */

app.get(
  "/api/image",
  async (req, res) => {
    const imageURL =
      String(
        req.query.url || ""
      ).trim();

    if (!imageURL) {
      return res.status(400).send(
        "Missing image URL"
      );
    }

    try {
      const response =
        await fetch(imageURL, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 Zyomira/1.0",
            "Referer":
              "https://mangadex.org/"
          }
        });

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
        ) ||
          "image/jpeg"
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
  }
);

/* ---------------- SOURCES ---------------- */

app.get(
  "/api/sources",
  (req, res) => {
    res.json({
      sources: [
        {
          id: SOURCE,
          name: "MangaDex",

          enabled: true,

          search: true,
          details: true,
          chapters: true,
          reader: true,

          types: [
            "manga"
          ]
        }
      ]
    });
  }
);

/* ---------------- REPOSITORY ---------------- */

app.get(
  "/api/repository",
  (req, res) => {
    res.json({
      name: "Zyomira Repository",
      version: 4,

      extensions: [
        {
          id: SOURCE,
          name: "MangaDex",

          type: "manga",

          supports: [
            "manga"
          ],

          reader: true,
          enabled: true
        }
      ]
    });
  }
);

/* ---------------- ERROR HANDLER ---------------- */

app.use(
  (err, req, res, next) => {
    console.error(
      "SERVER ERROR:",
      err
    );

    res.status(500).json({
      error:
        "Internal server error."
    });
  }
);

/* ---------------- START ---------------- */

app.listen(
  PORT,
  () => {
    console.log(
      `Zyomira MangaDex backend running on port ${PORT}`
    );
  }
);