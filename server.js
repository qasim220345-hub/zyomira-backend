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


/* =========================
   HOME
========================= */

app.get("/", (req, res) => {
  res.json({
    service: "Zyomira backend",
    status: "online",
    source: SOURCE
  });
});


/* =========================
   HEALTH
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Zyomira backend",
    source: SOURCE
  });
});


/* =========================
   SEARCH
========================= */

app.get("/api/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();

    if (!q) {
      return res.json([]);
    }

    const params = new URLSearchParams();

    params.set("title", q);
    params.set("limit", "20");

    params.append(
      "includes[]",
      "cover_art"
    );

    params.append(
      "contentRating[]",
      "safe"
    );

    params.append(
      "contentRating[]",
      "suggestive"
    );

    params.append(
      "availableTranslatedLanguage[]",
      "en"
    );

    const response = await fetch(
      MDX + "/manga?" + params.toString(),
      {
        headers: MD_HEADERS
      }
    );

    const text = await response.text();

    if (!response.ok) {
      console.error(
        "Search error:",
        response.status,
        text
      );

      return res.status(response.status).json({
        error: "MangaDex search failed"
      });
    }

    const data = JSON.parse(text);

    const results = (data.data || []).map(item => {
      const attrs = item.attributes || {};

      const coverRel =
        (item.relationships || []).find(
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
          Object.values(
            attrs.title || {}
          )[0] ||
          "Unknown",

        description:
          attrs.description?.en ||
          Object.values(
            attrs.description || {}
          )[0] ||
          "",

        status:
          attrs.status || "unknown",

        year:
          attrs.year || "",

        type:
          "Manga",

        cover
      };
    });

    res.json(results);

  } catch (error) {
    console.error(
      "Search exception:",
      error
    );

    res.status(500).json({
      error: "Search failed"
    });
  }
});


/* =========================
   TITLE
========================= */

app.get(
  "/api/source/comix/title/:id",
  async (req, res) => {

    try {
      const id =
        String(req.params.id || "").trim();

      if (!id) {
        return res.status(400).json({
          error: "Missing manga ID"
        });
      }

      const params =
        new URLSearchParams();

      params.append(
        "includes[]",
        "cover_art"
      );

      const response =
        await fetch(
          MDX +
          "/manga/" +
          encodeURIComponent(id) +
          "?" +
          params.toString(),
          {
            headers: MD_HEADERS
          }
        );

      const text =
        await response.text();

      if (!response.ok) {
        console.error(
          "Title error:",
          response.status,
          text
        );

        return res.status(
          response.status
        ).json({
          error:
            "MangaDex title request failed"
        });
      }

      const data =
        JSON.parse(text);

      const item =
        data.data;

      if (!item) {
        return res.status(404).json({
          error: "Title not found"
        });
      }

      const attrs =
        item.attributes || {};

      const coverRel =
        (item.relationships || []).find(
          r => r.type === "cover_art"
        );

      const fileName =
        coverRel?.attributes?.fileName ||
        "";

      const cover =
        fileName
          ? "https://uploads.mangadex.org/covers/" +
            id +
            "/" +
            fileName
          : "";

      res.json({
        id,

        title:
          attrs.title?.en ||
          Object.values(
            attrs.title || {}
          )[0] ||
          "Unknown",

        description:
          attrs.description?.en ||
          Object.values(
            attrs.description || {}
          )[0] ||
          "",

        status:
          attrs.status ||
          "unknown",

        type:
          "Manga",

        cover
      });

    } catch (error) {
      console.error(
        "Title exception:",
        error
      );

      res.status(500).json({
        error:
          "Could not load title"
      });
    }
  }
);


/* =========================
   CHAPTER LIST
========================= */

app.get(
  "/api/source/comix/title/:id/chapters",
  async (req, res) => {

    try {

      const mangaId =
        String(
          req.params.id || ""
        ).trim();

      if (!mangaId) {
        return res.status(400).json({
          error:
            "Missing manga ID"
        });
      }

      const params =
        new URLSearchParams();

      /*
       * IMPORTANT:
       * MangaDex expects manga
       * as a STRING.
       */

      params.set(
        "manga",
        mangaId
      );

      params.append(
        "translatedLanguage[]",
        "en"
      );

      params.append(
        "contentRating[]",
        "safe"
      );

      params.append(
        "contentRating[]",
        "suggestive"
      );

      params.set(
        "order[chapter]",
        "asc"
      );

      params.set(
        "order[volume]",
        "asc"
      );

      params.set(
        "limit",
        "100"
      );

      const url =
        MDX +
        "/chapter?" +
        params.toString();

      console.log(
        "Chapter list request:",
        url
      );

      const response =
        await fetch(
          url,
          {
            headers: MD_HEADERS
          }
        );

      const text =
        await response.text();

      console.log(
        "Chapter list status:",
        response.status
      );

      if (!response.ok) {

        console.error(
          "Chapter list error:",
          response.status,
          text
        );

        return res.status(
          response.status
        ).json({

          error:
            "MangaDex chapter list failed",

          status:
            response.status,

          details:
            text.slice(0, 1500)

        });
      }

      let data;

      try {
        data =
          JSON.parse(text);
      } catch {
        return res.status(502).json({
          error:
            "MangaDex returned invalid JSON"
        });
      }

      const chapters =
        (data.data || [])
        .map(item => {

          const attrs =
            item.attributes || {};

          return {

            id:
              item.id,

            number:
              attrs.chapter ||
              "0",

            title:
              attrs.title ||
              "",

            volume:
              attrs.volume ||
              "",

            pages:
              attrs.pages ||
              0,

            publishedAt:
              attrs.publishAt ||
              "",

            readable:
              attrs.externalUrl
                ? false
                : true,

            externalUrl:
              attrs.externalUrl ||
              ""

          };

        });

      console.log(
        "Chapters loaded:",
        chapters.length
      );

      res.json({
        chapters,
        total:
          data.total ||
          chapters.length
      });

    } catch (error) {

      console.error(
        "Chapter list exception:",
        error
      );

      res.status(500).json({

        error:
          "Could not load chapters",

        message:
          error.message

      });
    }
  }
);


/* =========================
   READER
========================= */

app.get(
  "/api/source/comix/chapter/:chapterId",
  async (req, res) => {

    const chapterId =
      String(
        req.params.chapterId || ""
      ).trim();

    console.log(
      "Reader request:",
      chapterId
    );

    if (!chapterId) {

      return res.status(400).json({
        error:
          "Missing chapter ID"
      });

    }

    try {

      /*
       * Ask MangaDex for the
       * At-Home server.
       */

      const url =
        MDX +
        "/at-home/server/" +
        encodeURIComponent(
          chapterId
        );

      const response =
        await fetch(
          url,
          {
            headers: MD_HEADERS
          }
        );

      const text =
        await response.text();

      console.log(
        "MangaDex reader status:",
        response.status
      );

      console.log(
        "MangaDex response:",
        text.slice(0, 3000)
      );

      if (!response.ok) {

        return res.status(
          response.status
        ).json({

          error:
            "MangaDex reader request failed",

          status:
            response.status,

          details:
            text.slice(0, 2000)

        });

      }

      let data;

      try {

        data =
          JSON.parse(text);

      } catch {

        return res.status(502).json({

          error:
            "MangaDex returned invalid JSON"

        });

      }


      /* -------------------------
         BASE URL
      ------------------------- */

      const baseUrl =
        data.baseUrl ||
        data.base_url ||
        data.baseURL ||
        "";


      /* -------------------------
         CHAPTER DATA
      ------------------------- */

      const chapter =
        data.chapter ||
        data.data?.chapter ||
        null;


      /*
       * If MangaDex gives an
       * external URL, return it.
       */

      const externalUrl =
        chapter?.externalUrl ||
        data.externalUrl ||
        "";


      if (
        !baseUrl &&
        externalUrl
      ) {

        console.log(
          "External chapter:",
          externalUrl
        );

        return res.json({

          source:
            SOURCE,

          chapterId,

          pages: [],

          count: 0,

          externalUrl

        });

      }


      if (!chapter) {

        console.error(
          "No chapter object:",
          JSON.stringify(
            data,
            null,
            2
          ).slice(0, 4000)
        );

        return res.status(502).json({

          error:
            "Invalid MangaDex chapter data",

          responseKeys:
            Object.keys(
              data || {}
            ),

          hasBaseUrl:
            !!baseUrl,

          hasChapter:
            false

        });

      }


      /* -------------------------
         HASH
      ------------------------- */

      const hash =
        String(
          chapter.hash ||
          chapter.chapterHash ||
          ""
        ).trim();


      /* -------------------------
         PAGE FILENAMES
      ------------------------- */

      let filenames = [];


      /*
       * Normal quality.
       */

      if (
        Array.isArray(
          chapter.data
        )
      ) {

        filenames =
          chapter.data;

      }


      /*
       * Data Saver.
       */

      if (
        !filenames.length &&
        Array.isArray(
          chapter.dataSaver
        )
      ) {

        filenames =
          chapter.dataSaver;

      }


      /*
       * Some responses may
       * contain a pages array.
       */

      if (
        !filenames.length &&
        Array.isArray(
          chapter.pages
        )
      ) {

        filenames =
          chapter.pages;

      }


      /*
       * Convert page objects
       * into filenames.
       */

      filenames =
        filenames
        .map(page => {

          if (
            typeof page === "string"
          ) {

            return page;

          }

          if (
            page &&
            typeof page === "object"
          ) {

            return (
              page.filename ||
              page.fileName ||
              page.name ||
              page.path ||
              ""
            );

          }

          return "";

        })
        .filter(Boolean);


      console.log(
        "Reader baseUrl:",
        baseUrl
      );

      console.log(
        "Reader hash:",
        hash
      );

      console.log(
        "Reader normal pages:",
        Array.isArray(
          chapter.data
        )
          ? chapter.data.length
          : 0
      );

      console.log(
        "Reader saver pages:",
        Array.isArray(
          chapter.dataSaver
        )
          ? chapter.dataSaver.length
          : 0
      );

      console.log(
        "Reader final filenames:",
        filenames.length
      );


      /*
       * No pages.
       */

      if (
        !hash ||
        !filenames.length
      ) {

        console.error(
          "Chapter contains no page filenames."
        );

        return res.status(502).json({

          error:
            "Chapter contains no readable pages",

          hasBaseUrl:
            !!baseUrl,

          hasHash:
            !!hash,

          normalPages:
            Array.isArray(
              chapter.data
            )
              ? chapter.data.length
              : 0,

          saverPages:
            Array.isArray(
              chapter.dataSaver
            )
              ? chapter.dataSaver.length
              : 0,

          externalUrl:
            externalUrl || ""

        });

      }


      /* -------------------------
         BUILD PAGES
      ------------------------- */

      const pages =
        filenames.map(
          filename => {

            return (
              baseUrl +
              "/data/" +
              encodeURIComponent(
                hash
              ) +
              "/" +
              encodeURIComponent(
                filename
              )
            );

          }
        );


      console.log(
        "Reader pages:",
        pages.length
      );


      res.json({

        source:
          SOURCE,

        chapterId,

        pages,

        count:
          pages.length,

        externalUrl:
          externalUrl || ""

      });

    } catch (error) {

      console.error(
        "Reader exception:",
        error
      );

      res.status(500).json({

        error:
          "Reader request failed",

        message:
          error.message

      });

    }
  }
);


/* =========================
   IMAGE PROXY
========================= */

app.get(
  "/api/image",
  async (req, res) => {

    try {

      const imageUrl =
        String(
          req.query.url || ""
        ).trim();

      if (!imageUrl) {

        return res.status(400).send(
          "Missing image URL"
        );

      }

      if (
        !imageUrl.includes(
          "mangadex"
        )
      ) {

        return res.status(403).send(
          "Image host not allowed"
        );

      }

      const response =
        await fetch(
          imageUrl,
          {
            headers: {

              "User-Agent":
                "Zyomira/1.0",

              "Referer":
                "https://mangadex.org/"

            }
          }
        );

      if (!response.ok) {

        return res.status(
          response.status
        ).send(
          "Image request failed"
        );

      }

      res.setHeader(
        "Content-Type",
        response.headers.get(
          "content-type"
        ) || "image/jpeg"
      );

      res.setHeader(
        "Cache-Control",
        "public, max-age=86400"
      );

      const buffer =
        Buffer.from(
          await response.arrayBuffer()
        );

      res.send(buffer);

    } catch (error) {

      console.error(
        "Image proxy error:",
        error
      );

      res.status(500).send(
        "Could not load image"
      );

    }
  }
);


/* =========================
   SOURCES
========================= */

app.get(
  "/api/sources",
  (req, res) => {

    res.json([

      {
        id:
          "mangadex",

        name:
          "MangaDex",

        type:
          "Manga / MangaDex",

        enabled:
          true
      }

    ]);

  }
);


/* =========================
   REPOSITORY
========================= */

app.get(
  "/api/repository",
  async (req, res) => {

    try {

      const repositoryUrl =
        String(
          req.query.url || ""
        ).trim();

      if (!repositoryUrl) {

        return res.status(400).json({
          error:
            "Missing repository URL"
        });

      }

      if (
        !/^https?:\/\//i.test(
          repositoryUrl
        )
      ) {

        return res.status(400).json({
          error:
            "Invalid repository URL"
        });

      }

      const response =
        await fetch(
          repositoryUrl,
          {
            headers: {

              "User-Agent":
                "Zyomira/1.0",

              "Accept":
                "application/json"

            }
          }
        );

      const text =
        await response.text();

      if (!response.ok) {

        return res.status(
          response.status
        ).json({

          error:
            "Repository request failed: " +
            response.status

        });

      }

      let data;

      try {

        data =
          JSON.parse(text);

      } catch {

        return res.status(400).json({

          error:
            "Repository is not valid JSON"

        });

      }

      let extensions = [];


      if (
        Array.isArray(data)
      ) {

        extensions =
          data;

      } else if (
        Array.isArray(
          data.extensions
        )
      ) {

        extensions =
          data.extensions;

      } else if (
        Array.isArray(
          data.sources
        )
      ) {

        extensions =
          data.sources;

      } else if (
        Array.isArray(
          data.data
        )
      ) {

        extensions =
          data.data;

      }


      res.json({

        ok:
          true,

        repository: {

          name:
            data.name ||
            data.title ||
            "Repository",

          format:
            "json"

        },

        extensions

      });

    } catch (error) {

      console.error(
        "Repository error:",
        error
      );

      res.status(500).json({

        error:
          error.message ||
          "Could not read repository"

      });

    }
  }
);


/* =========================
   START
========================= */

app.listen(
  PORT,
  () => {

    console.log(
      "Zyomira backend running on port " +
      PORT
    );

  }
);