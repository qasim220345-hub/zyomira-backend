const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

/* =========================================================
   DEMO TITLES
========================================================= */

const titles = [
  {
    id: "solo-leveling",
    title: "Solo Leveling",
    type: "Manhwa",
    status: "Completed",
    description: "Fantasy action series.",
    cover:
      "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600"
  },
  {
    id: "beginning-after-end",
    title: "The Beginning After the End",
    type: "Manhwa",
    status: "Ongoing",
    description: "A powerful king is reborn into a new world.",
    cover:
      "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600"
  },
  {
    id: "manga-collection",
    title: "Manga Collection",
    type: "Manga",
    status: "Collection",
    description: "A demo manga collection for Zyomira.",
    cover:
      "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=600"
  },
  {
    id: "manhua-collection",
    title: "Manhua Collection",
    type: "Manhua",
    status: "Collection",
    description: "A demo manhua collection for Zyomira.",
    cover:
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600"
  }
];

const demoPages = [
  "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200",
  "https://images.unsplash.com/photo-1613376023733-0a73315d9b06?w=1200",
  "https://images.unsplash.com/photo-1541560052-77ec1bbc09f7?w=1200",
  "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=1200"
];

/* =========================================================
   BASIC API
========================================================= */

app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Zyomira API",
    message: "Zyomira backend is running."
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Zyomira backend"
  });
});

/* =========================================================
   SEARCH
========================================================= */

app.get("/api/search", (req, res) => {
  const query = String(req.query.q || "")
    .trim()
    .toLowerCase();

  if (!query) {
    return res.json({
      query: "",
      results: []
    });
  }

  const results = titles.filter(item =>
    item.title.toLowerCase().includes(query) ||
    item.type.toLowerCase().includes(query) ||
    item.description.toLowerCase().includes(query)
  );

  res.json({
    query,
    results
  });
});

/* =========================================================
   TITLE
========================================================= */

app.get("/api/title/:id", (req, res) => {
  const item = titles.find(
    title => title.id === req.params.id
  );

  if (!item) {
    return res.status(404).json({
      error: "Title not found"
    });
  }

  res.json(item);
});

/* =========================================================
   CHAPTERS
========================================================= */

app.get("/api/title/:id/chapters", (req, res) => {
  const item = titles.find(
    title => title.id === req.params.id
  );

  if (!item) {
    return res.status(404).json({
      error: "Title not found"
    });
  }

  const chapters = Array.from(
    { length: 20 },
    (_, index) => ({
      number: index + 1,
      title: `Chapter ${index + 1}`,
      id: `${item.id}-chapter-${index + 1}`
    })
  );

  res.json({
    titleId: item.id,
    title: item.title,
    chapters
  });
});

/* =========================================================
   READER
========================================================= */

app.get(
  "/api/title/:id/chapter/:chapter",
  (req, res) => {
    const item = titles.find(
      title => title.id === req.params.id
    );

    if (!item) {
      return res.status(404).json({
        error: "Title not found"
      });
    }

    const chapterNumber =
      Number(req.params.chapter);

    if (
      !Number.isInteger(chapterNumber) ||
      chapterNumber < 1 ||
      chapterNumber > 20
    ) {
      return res.status(404).json({
        error: "Chapter not found"
      });
    }

    res.json({
      id: `${item.id}-chapter-${chapterNumber}`,
      title: item.title,
      chapter: chapterNumber,
      pages: demoPages.map((url, index) => ({
        page: index + 1,
        url
      }))
    });
  }
);

/* =========================================================
   REMOTE FETCH
========================================================= */

async function fetchBuffer(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Zyomira/1.2"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Remote server returned HTTP ${response.status}`
    );
  }

  return Buffer.from(
    await response.arrayBuffer()
  );
}

async function fetchText(url) {
  const buffer = await fetchBuffer(url);
  return buffer.toString("utf8");
}

/* =========================================================
   URL HELPERS
========================================================= */

function normalizeGitHubUrl(url) {
  try {
    const parsed = new URL(url);

    if (parsed.hostname !== "github.com") {
      return url;
    }

    const parts = parsed.pathname
      .split("/")
      .filter(Boolean);

    const rawIndex =
      parts.indexOf("raw");

    if (
      rawIndex !== -1 &&
      parts.length > rawIndex + 2
    ) {
      const owner = parts[0];
      const repo = parts[1];
      const branch = parts[rawIndex + 1];

      const file = parts
        .slice(rawIndex + 2)
        .join("/");

      return (
        `https://raw.githubusercontent.com/` +
        `${owner}/${repo}/${branch}/${file}`
      );
    }

    return url;
  } catch {
    return url;
  }
}

function normalizeRepoUrl(url) {
  return normalizeGitHubUrl(url);
}

function absoluteUrl(value, baseUrl) {
  if (!value) return "";

  try {
    return new URL(
      value,
      baseUrl
    ).href;
  } catch {
    return String(value);
  }
}

/* =========================================================
   JSON REPOSITORY
========================================================= */

async function loadJsonIndex(
  url,
  meta = {}
) {
  const text = await fetchText(url);

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      "Repository index is not valid JSON"
    );
  }

  const extensions =
    extractJsonExtensions(
      data,
      url
    );

  if (!extensions.length) {
    throw new Error(
      "JSON repository contains no extensions"
    );
  }

  return {
    name:
      meta.name ||
      data.name ||
      "JSON Repository",

    website:
      meta.website ||
      data.website ||
      "",

    format: "json",

    extensions
  };
}

/* =========================================================
   JSON EXTENSION PARSER
========================================================= */

function extractJsonExtensions(
  data,
  repositoryUrl
) {
  let array = [];

  if (Array.isArray(data)) {
    array = data;
  } else if (
    data &&
    typeof data === "object"
  ) {
    const candidates = [
      data.extensions,
      data.sources,
      data.items,
      data.entries,
      data.plugins,
      data.apps,
      data.data
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        array = candidate;
        break;
      }
    }
  }

  return normalizeExtensionArray(
    array,
    repositoryUrl
  );
}

/* =========================================================
   EXTENSION NORMALIZER

   IMPORTANT:
   Keiyoushi metadata looks like:

   {
     name,
     pkg,
     apk,
     lang,
     version,
     sources: [
       {
         name,
         lang,
         id,
         baseUrl
       }
     ]
   }

   We now extract BOTH:

   Extension metadata
   AND
   nested source metadata.
========================================================= */

function normalizeExtensionArray(
  array,
  repositoryUrl
) {
  const extensions = [];
  const sources = [];

  array
    .filter(
      item =>
        item &&
        typeof item === "object"
    )
    .forEach((item, index) => {
      const extensionId = String(
        item.pkg ||
        item.package ||
        item.id ||
        `extension-${index}`
      );

      const extensionName = String(
        item.name ||
        item.title ||
        item.label ||
        item.pkg ||
        "Unnamed Extension"
      );

      const extension = {
        id: extensionId,

        name: extensionName,

        description: String(
          item.description ||
          item.summary ||
          ""
        ),

        type: String(
          item.type ||
          item.category ||
          "Manga"
        ),

        lang: String(
          item.lang ||
          item.language ||
          ""
        ),

        url: absoluteUrl(
          item.url ||
          item.sourceUrl ||
          item.website ||
          "",
          repositoryUrl
        ),

        icon: absoluteUrl(
          item.icon ||
          item.iconUrl ||
          "",
          repositoryUrl
        ),

        version: String(
          item.version ||
          item.versionName ||
          item.versionCode ||
          ""
        ),

        versionCode:
          item.code != null
            ? String(item.code)
            : "",

        apk: absoluteUrl(
          item.apk || "",
          repositoryUrl
        ),

        nsfw:
          Number(item.nsfw || 0),

        sources: []
      };

      /* -----------------------------------------
         Nested Mihon/Keiyoushi sources
      ----------------------------------------- */

      if (
        Array.isArray(item.sources)
      ) {
        item.sources.forEach(
          (source, sourceIndex) => {
            if (
              !source ||
              typeof source !== "object"
            ) {
              return;
            }

            const baseUrl = String(
              source.baseUrl ||
              source.baseURL ||
              source.url ||
              ""
            ).trim();

            const sourceItem = {
              id: String(
                source.id ||
                `${extensionId}-source-${sourceIndex}`
              ),

              name: String(
                source.name ||
                extensionName
              ),

              lang: String(
                source.lang ||
                extension.lang ||
                ""
              ),

              baseUrl: absoluteUrl(
                baseUrl,
                repositoryUrl
              ),

              extensionId,

              extensionName
            };

            extension.sources.push(
              sourceItem
            );

            /*
              Only expose it as a usable
              source when baseUrl exists.
            */

            if (sourceItem.baseUrl) {
              sources.push(
                sourceItem
              );
            }
          }
        );
      }

      extensions.push(extension);
    });

  /*
    Keep the nested sources available
    on the repository result.
  */

  return extensions;
}

/* =========================================================
   FLATTEN SOURCES
========================================================= */

function flattenSources(
  extensions
) {
  const results = [];

  for (const extension of extensions) {
    if (
      !Array.isArray(
        extension.sources
      )
    ) {
      continue;
    }

    for (const source of extension.sources) {
      if (!source.baseUrl) {
        continue;
      }

      results.push({
        id: source.id,

        name: source.name,

        lang: source.lang,

        baseUrl: source.baseUrl,

        extensionId:
          source.extensionId,

        extensionName:
          source.extensionName,

        extensionVersion:
          extension.version || "",

        extensionPackage:
          extension.id || "",

        apk:
          extension.apk || "",

        icon:
          extension.icon || ""
      });
    }
  }

  return results;
}

/* =========================================================
   REPOSITORY LOADER
========================================================= */

async function loadRepositoryIndex(
  url,
  meta = {}
) {
  const normalized =
    normalizeRepoUrl(url);

  /*
    JSON
  */

  if (
    normalized
      .toLowerCase()
      .endsWith(".json") ||
    normalized.includes(
      "index.json"
    )
  ) {
    return loadJsonIndex(
      normalized,
      meta
    );
  }

  /*
    For a protobuf repository,
    try its JSON mirror first.

    Keiyoushi publishes index.min.json,
    index.json and index.pb.
  */

  if (
    normalized
      .toLowerCase()
      .endsWith(".pb") ||
    normalized.includes(
      "index.pb"
    )
  ) {
    const jsonCandidates =
      getJsonCandidates(
        normalized
      );

    for (
      const candidate of jsonCandidates
    ) {
      try {
        return await loadJsonIndex(
          candidate,
          meta
        );
      } catch {}
    }

    throw new Error(
      "Protobuf repository could not be converted into usable source metadata. Use its JSON index when available."
    );
  }

  /*
    Unknown format:
    JSON first.
  */

  try {
    return await loadJsonIndex(
      normalized,
      meta
    );
  } catch {}

  throw new Error(
    "Unsupported repository format"
  );
}

/* =========================================================
   JSON CANDIDATES FOR PB REPOSITORIES
========================================================= */

function getJsonCandidates(
  protobufUrl
) {
  const candidates = [];

  try {
    const parsed =
      new URL(protobufUrl);

    /*
      raw.githubusercontent.com
    */

    if (
      parsed.hostname ===
      "raw.githubusercontent.com"
    ) {
      const path =
        parsed.pathname;

      if (
        path.endsWith(
          "/index.pb"
        )
      ) {
        candidates.push(
          `${parsed.origin}` +
          path.replace(
            /\/index\.pb$/,
            "/index.min.json"
          )
        );

        candidates.push(
          `${parsed.origin}` +
          path.replace(
            /\/index\.pb$/,
            "/index.json"
          )
        );
      }
    }

    /*
      github.com/.../raw/...
    */

    if (
      parsed.hostname ===
      "github.com"
    ) {
      const raw =
        normalizeGitHubUrl(
          protobufUrl
        );

      if (raw !== protobufUrl) {
        candidates.push(
          ...getJsonCandidates(raw)
        );
      }
    }
  } catch {}

  return [
    ...new Set(candidates)
  ];
}

/* =========================================================
   PUBLIC REPOSITORY API
========================================================= */

app.get(
  "/api/repository",
  async (req, res) => {
    const rawUrl =
      String(
        req.query.url || ""
      ).trim();

    if (!rawUrl) {
      return res.status(400).json({
        ok: false,
        error:
          "Missing repository URL"
      });
    }

    let url;

    try {
      url =
        new URL(rawUrl).href;
    } catch {
      return res.status(400).json({
        ok: false,
        error:
          "Invalid repository URL"
      });
    }

    if (
      !url.startsWith(
        "http://"
      ) &&
      !url.startsWith(
        "https://"
      )
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "Only HTTP and HTTPS repositories are supported"
      });
    }

    try {
      const result =
        await loadRepositoryIndex(
          url
        );

      const sources =
        flattenSources(
          result.extensions
        );

      res.json({
        ok: true,

        repository: {
          url,

          name:
            result.name ||
            "Repository",

          website:
            result.website ||
            "",

          format:
            result.format ||
            "json"
        },

        extensionCount:
          result.extensions.length,

        sourceCount:
          sources.length,

        extensions:
          result.extensions,

        sources
      });
    } catch (error) {
      console.error(
        "Repository error:",
        error
      );

      res.status(502).json({
        ok: false,

        error:
          error.message ||
          "Could not read repository"
      });
    }
  }
);

/* =========================================================
   SOURCES API
========================================================= */

/*
  This endpoint returns only actual source
  metadata extracted from repositories.

  It does NOT execute Mihon APKs.
*/

app.get(
  "/api/sources",
  async (req, res) => {
    const rawUrl =
      String(
        req.query.url || ""
      ).trim();

    if (!rawUrl) {
      return res.status(400).json({
        ok: false,
        error:
          "Missing repository URL"
      });
    }

    try {
      const url =
        new URL(rawUrl).href;

      const result =
        await loadRepositoryIndex(
          url
        );

      const sources =
        flattenSources(
          result.extensions
        );

      res.json({
        ok: true,

        repository: {
          url,

          name:
            result.name ||
            "Repository",

          format:
            result.format ||
            "json"
        },

        count:
          sources.length,

        sources
      });
    } catch (error) {
      res.status(502).json({
        ok: false,

        error:
          error.message ||
          "Could not load sources"
      });
    }
  }
);

/* =========================================================
   404
========================================================= */

app.use(
  (req, res) => {
    res.status(404).json({
      error:
        "Endpoint not found",
      path:
        req.path
    });
  }
);

/* =========================================================
   START
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Zyomira backend running on port ${PORT}`
    );
  }
);