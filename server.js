const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

/*
  Working Comick API proxy
*/
const COMICK_PROXY =
  "https://comick-api-proxy.notaspider.dev/api/v1.0";


/* =====================================================
   HOME
===================================================== */

app.get("/", (req, res) => {
  res.json({
    service: "Zyomira backend",
    status: "online"
  });
});


/* =====================================================
   HEALTH
===================================================== */

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Zyomira backend"
  });
});


/* =====================================================
   SEARCH
===================================================== */

app.get("/api/search", async (req, res) => {

  const query =
    String(req.query.q || "").trim();

  if (!query) {
    return res.status(400).json({
      error: "Missing search query"
    });
  }

  try {

    const url =
      COMICK_PROXY +
      "/search?q=" +
      encodeURIComponent(query);

    const response =
      await fetch(url);

    if (!response.ok) {

      return res.status(502).json({
        error:
          "Comick search is temporarily unavailable.",
        source: "comick",
        details:
          "HTTP " + response.status
      });
    }

    const raw =
      await response.json();

    /*
      The proxy returns an array directly.
    */

    const items =
      Array.isArray(raw)
        ? raw
        : Array.isArray(raw.results)
          ? raw.results
          : [];

    /*
      Keep the catalog SFW.
      Explicit/pornographic results are removed.
    */

    const safeResults =
      items
        .filter(item => {

          const rating =
            String(
              item.content_rating ||
              item.contentRating ||
              ""
            ).toLowerCase();

          return rating !== "pornographic";

        })
        .map(item => {

          const coverKey =
            item.md_covers &&
            item.md_covers[0] &&
            item.md_covers[0].b2key;

          let cover = "";

          if (coverKey) {

            cover =
              "https://meo.comick.pictures/" +
              coverKey;
          }

          return {

            id:
              item.hid ||
              item.id ||
              "",

            hid:
              item.hid ||
              item.id ||
              "",

            slug:
              item.slug ||
              "",

            title:
              item.title ||
              "Unknown title",

            description:
              item.desc ||
              item.description ||
              "",

            cover:
              cover,

            thumbnail:
              cover,

            country:
              item.country ||
              "",

            status:
              item.status,

            year:
              item.year,

            lastChapter:
              item.last_chapter,

            contentRating:
              item.content_rating ||
              "safe",

            media_type:
              item.media_type ||
              "manga",

            source:
              "comick"
          };

        });

    res.json({

      source: "comick",

      query: query,

      count:
        safeResults.length,

      results:
        safeResults

    });

  } catch (error) {

    console.error(
      "Comick search error:",
      error
    );

    res.status(502).json({

      error:
        "Could not connect to Comick.",

      source:
        "comick",

      details:
        error.message

    });

  }

});


/* =====================================================
   COMICK TITLE
===================================================== */

app.get(
  "/api/source/comick/title/:hid",
  async (req, res) => {

    const hid =
      req.params.hid;

    try {

      /*
        Try the proxy title endpoint.
      */

      const response =
        await fetch(
          COMICK_PROXY +
          "/comic/" +
          encodeURIComponent(hid)
        );

      if (!response.ok) {

        return res.status(
          response.status
        ).json({
          error:
            "Could not load title.",
          details:
            "HTTP " +
            response.status
        });

      }

      const data =
        await response.json();

      res.json(data);

    } catch (error) {

      console.error(
        "Title error:",
        error
      );

      res.status(502).json({
        error:
          "Could not load title.",
        details:
          error.message
      });

    }

  }
);


/* =====================================================
   CHAPTERS
===================================================== */

app.get(
  "/api/source/comick/title/:hid/chapters",
  async (req, res) => {

    const hid =
      req.params.hid;

    const lang =
      req.query.lang ||
      "en";

    try {

      const url =
        COMICK_PROXY +
        "/comic/" +
        encodeURIComponent(hid) +
        "/chapters?lang=" +
        encodeURIComponent(lang);

      const response =
        await fetch(url);

      if (!response.ok) {

        return res.status(
          response.status
        ).json({
          error:
            "Could not load chapters.",
          details:
            "HTTP " +
            response.status
        });

      }

      const data =
        await response.json();

      const chapters =
        Array.isArray(data)
          ? data
          : Array.isArray(data.chapters)
            ? data.chapters
            : [];

      res.json({
        chapters:
          chapters
      });

    } catch (error) {

      console.error(
        "Chapter error:",
        error
      );

      res.status(502).json({
        error:
          "Could not load chapters.",
        details:
          error.message
      });

    }

  }
);


/* =====================================================
   CHAPTER PAGES
===================================================== */

app.get(
  "/api/source/comick/chapter/:chapterHid",
  async (req, res) => {

    const chapterHid =
      req.params.chapterHid;

    try {

      const url =
        COMICK_PROXY +
        "/chapter/" +
        encodeURIComponent(
          chapterHid
        );

      const response =
        await fetch(url);

      if (!response.ok) {

        return res.status(
          response.status
        ).json({
          error:
            "Could not load chapter.",
          details:
            "HTTP " +
            response.status
        });

      }

      const data =
        await response.json();

      /*
        Try several common response shapes.
      */

      let pages = [];

      if (Array.isArray(data)) {

        pages = data;

      } else if (
        Array.isArray(data.pages)
      ) {

        pages = data.pages;

      } else if (
        Array.isArray(
          data.chapter
        )
      ) {

        pages = data.chapter;

      }

      pages =
        pages
          .map(page => {

            if (
              typeof page === "string"
            ) {

              return {
                url: page
              };

            }

            return {
              url:
                page.url ||
                page.image ||
                page.img ||
                page.media?.url ||
                ""
            };

          })
          .filter(
            page =>
              page.url
          );

      res.json({
        pages:
          pages
      });

    } catch (error) {

      console.error(
        "Reader error:",
        error
      );

      res.status(502).json({
        error:
          "Could not load chapter pages.",
        details:
          error.message
      });

    }

  }
);


/* =====================================================
   IMAGE PROXY
===================================================== */

app.get(
  "/api/image",
  async (req, res) => {

    const imageUrl =
      String(
        req.query.url || ""
      );

    if (!imageUrl) {

      return res.status(400).json({
        error:
          "Missing image URL"
      });

    }

    try {

      const response =
        await fetch(
          imageUrl,
          {
            headers:{
              "User-Agent":
                "Mozilla/5.0"
            }
          }
        );

      if (!response.ok) {

        return res.status(
          response.status
        ).end();

      }

      const contentType =
        response.headers.get(
          "content-type"
        ) ||
        "image/jpeg";

      res.setHeader(
        "Content-Type",
        contentType
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

      res.status(502).end();

    }

  }
);


/* =====================================================
   REPOSITORY
===================================================== */

app.get(
  "/api/repository",
  async (req, res) => {

    const url =
      String(
        req.query.url || ""
      ).trim();

    if (!url) {

      return res.status(400).json({
        error:
          "Missing repository URL"
      });

    }

    try {

      const response =
        await fetch(url);

      if (!response.ok) {

        return res.status(
          response.status
        ).json({
          error:
            "Repository could not be loaded.",
          details:
            "HTTP " +
            response.status
        });

      }

      const data =
        await response.json();

      res.json(data);

    } catch (error) {

      console.error(
        "Repository error:",
        error
      );

      res.status(502).json({
        error:
          "Could not load repository.",
        details:
          error.message
      });

    }

  }
);


/* =====================================================
   SOURCES
===================================================== */

app.get(
  "/api/sources",
  async (req, res) => {

    const url =
      String(
        req.query.url || ""
      ).trim();

    if (!url) {

      return res.status(400).json({
        error:
          "Missing repository URL"
      });

    }

    try {

      const response =
        await fetch(url);

      if (!response.ok) {

        return res.status(
          response.status
        ).json({
          error:
            "Could not load sources."
        });

      }

      const data =
        await response.json();

      const extensions =
        Array.isArray(data.extensions)
          ? data.extensions
          : [];

      const sources = [];

      extensions.forEach(
        extension => {

          if(
            extension.baseUrl
          ){

            sources.push({
              name:
                extension.name ||
                extension.extensionName,

              baseUrl:
                extension.baseUrl,

              lang:
                extension.lang ||
                "unknown"
            });

          }

          if(
            Array.isArray(
              extension.sources
            )
          ){

            extension.sources.forEach(
              source => {

                if(
                  source.baseUrl
                ){

                  sources.push({
                    name:
                      source.name ||
                      extension.name,

                    baseUrl:
                      source.baseUrl,

                    lang:
                      source.lang ||
                      extension.lang ||
                      "unknown"
                  });

                }

              }
            );

          }

        }
      );

      res.json({
        sources:
          sources
      });

    } catch (error) {

      res.status(502).json({
        error:
          "Could not load sources.",
        details:
          error.message
      });

    }

  }
);


/* =====================================================
   START SERVER
===================================================== */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Zyomira backend running on port ${PORT}`
    );

  }
);