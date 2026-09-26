const express = require("express");
const cors = require("cors");
const protobuf = require("protobufjs");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

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

/* =========================
   BASIC API
========================= */

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

    const chapterNumber = Number(req.params.chapter);

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

/* =========================
   REPOSITORY FETCHER
========================= */

async function fetchBuffer(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Zyomira/1.1"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Repository returned HTTP ${response.status}`
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

async function fetchText(url) {
  const buffer = await fetchBuffer(url);
  return buffer.toString("utf8");
}

/* =========================
   URL NORMALIZATION
========================= */

function githubRawUrl(url) {
  try {
    const parsed = new URL(url);

    if (parsed.hostname !== "github.com") {
      return null;
    }

    const parts = parsed.pathname
      .split("/")
      .filter(Boolean);

    /*
      github.com/user/repo/raw/branch/file
    */

    const rawIndex = parts.indexOf("raw");

    if (rawIndex !== -1 && parts.length > rawIndex + 2) {
      const branch = parts[rawIndex + 1];

      const file = parts
        .slice(rawIndex + 2)
        .join("/");

      return `https://raw.githubusercontent.com/${parts[0]}/${parts[1]}/${branch}/${file}`;
    }

    return null;
  } catch {
    return null;
  }
}

/*
  If user gives:
  github.com/keiyoushi/extensions/raw/repo/index.pb

  keep it as-is.

  If user gives a GitHub normal URL, try raw conversion.
*/

function normalizeRepoUrl(url) {
  const raw = githubRawUrl(url);

  return raw || url;
}

/* =========================
   REPO.JSON
========================= */

async function readRepoJson(url) {
  const text = await fetchText(url);

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("repo.json is not valid JSON");
  }

  if (!data || typeof data !== "object") {
    throw new Error("Invalid repository metadata");
  }

  return data;
}

/* =========================
   PROTOBUF INDEX
========================= */

/*
  Important:

  Keiyoushi's index.pb is a protobuf binary index.
  We intentionally do not execute extension code.

  The backend first tries to locate the repository's
  JSON index because the same repository publishes
  machine-readable JSON metadata alongside index.pb.

  This gives Zyomira compatibility without executing
  arbitrary code from an external repository.
*/

async function loadProtobufRepository(url) {
  const original = url;

  /*
    Try repo.json from the same GitHub repository.
  */

  let repoJsonUrl = null;

  try {
    const parsed = new URL(original);

    if (
      parsed.hostname === "raw.githubusercontent.com" &&
      parsed.pathname.endsWith("/index.pb")
    ) {
      repoJsonUrl =
        `${parsed.origin}` +
        parsed.pathname
          .replace(/\/index\.pb$/, "/repo.json");
    }

    if (
      parsed.hostname === "github.com" &&
      parsed.pathname.includes("/raw/")
    ) {
      const raw = normalizeRepoUrl(original);

      if (raw) {
        const rawParsed = new URL(raw);

        repoJsonUrl =
          `${rawParsed.origin}` +
          rawParsed.pathname
            .replace(/\/index\.pb$/, "/repo.json");
      }
    }
  } catch {}

  /*
    If repo.json exists, use its index_v2 and metadata.
  */

  if (repoJsonUrl) {
    try {
      const repoData = await readRepoJson(repoJsonUrl);

      if (repoData.index_v2) {
        return await loadRepositoryIndex(
          repoData.index_v2,
          repoData.meta || {}
        );
      }
    } catch {}
  }

  /*
    Direct protobuf fallback.
  */

  const buffer = await fetchBuffer(original);

  if (!buffer.length) {
    throw new Error("Empty protobuf index");
  }

  /*
    Decode protobuf wire format generically.

    This lets us inspect strings and nested messages
    without executing any extension code.
  */

  const strings = extractProtoStrings(buffer);

  const extensions = stringsToExtensions(strings);

  if (!extensions.length) {
    throw new Error(
      "Protobuf index was downloaded but no compatible extension metadata was found"
    );
  }

  return {
    name: "Protobuf Repository",
    format: "protobuf",
    extensions
  };
}

/* =========================
   GENERIC PROTO STRING READER
========================= */

function readVarint(buffer, offset) {
  let value = 0;
  let shift = 0;
  let position = offset;

  while (position < buffer.length) {
    const byte = buffer[position++];

    value +=
      (byte & 0x7f) *
      Math.pow(2, shift);

    if (!(byte & 0x80)) {
      break;
    }

    shift += 7;

    if (shift > 63) {
      throw new Error("Invalid protobuf varint");
    }
  }

  return {
    value,
    offset: position
  };
}

function extractProtoStrings(buffer) {
  const strings = [];

  function scan(data, depth = 0) {
    if (depth > 8) return;

    let offset = 0;

    while (offset < data.length) {
      try {
        const tag = readVarint(data, offset);
        offset = tag.offset;

        const wireType = tag.value & 7;

        if (wireType === 0) {
          const value = readVarint(data, offset);
          offset = value.offset;
          continue;
        }

        if (wireType === 1) {
          offset += 8;
          continue;
        }

        if (wireType === 2) {
          const lengthInfo =
            readVarint(data, offset);

          offset = lengthInfo.offset;

          const length =
            Number(lengthInfo.value);

          if (
            length < 0 ||
            offset + length > data.length
          ) {
            break;
          }

          const chunk =
            data.subarray(
              offset,
              offset + length
            );

          offset += length;

          const text =
            chunk.toString("utf8");

          if (isUsefulString(text)) {
            strings.push(text);
          }

          /*
            Nested protobuf message.
          */

          if (looksLikeProto(chunk)) {
            scan(chunk, depth + 1);
          }

          continue;
        }

        if (wireType === 5) {
          offset += 4;
          continue;
        }

        break;
      } catch {
        break;
      }
    }
  }

  scan(buffer);

  return [...new Set(strings)];
}

function isUsefulString(value) {
  if (!value || value.length < 3) {
    return false;
  }

  if (value.length > 1000) {
    return false;
  }

  let printable = 0;

  for (const char of value) {
    const code = char.charCodeAt(0);

    if (
      code === 9 ||
      code === 10 ||
      code === 13 ||
      (code >= 32 && code <= 126)
    ) {
      printable++;
    }
  }

  return printable / value.length > 0.85;
}

function looksLikeProto(buffer) {
  if (buffer.length < 2) return false;

  const first = buffer[0];

  /*
    Typical protobuf field tags are small.
  */

  return first > 0 && first < 128;
}

/* =========================
   STRING → EXTENSION METADATA
========================= */

function stringsToExtensions(strings) {
  const urls = strings.filter(
    value =>
      value.startsWith("http://") ||
      value.startsWith("https://")
  );

  const names = strings.filter(
    value =>
      !value.includes("://") &&
      !value.includes("/") &&
      value.length >= 3 &&
      value.length <= 100
  );

  const results = [];

  /*
    We only expose metadata we can identify.
    We do NOT execute the extension.
  */

  urls.forEach((url, index) => {
    const domain = safeHostname(url);

    if (!domain) return;

    results.push({
      id: `pb-${index}-${domain}`,
      name: domain,
      description:
        "Source discovered from a Protocol Buffers repository index.",
      type: "Manga",
      lang: "",
      url,
      version: ""
    });
  });

  /*
    If URLs were not found, names can still help
    confirm that the protobuf file was decoded.
  */

  if (!results.length && names.length) {
    names.slice(0, 100).forEach((name, index) => {
      results.push({
        id: `pb-name-${index}-${name}`,
        name,
        description:
          "Extension metadata discovered from protobuf index.",
        type: "Manga",
        lang: "",
        url: "",
        version: ""
      });
    });
  }

  return results.slice(0, 500);
}

function safeHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/* =========================
   INDEX.JSON SUPPORT
========================= */

async function loadJsonIndex(url, meta = {}) {
  const text = await fetchText(url);

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Index is not valid JSON");
  }

  const extensions =
    extractJsonExtensions(data);

  if (!extensions.length) {
    throw new Error(
      "JSON repository contains no compatible extensions"
    );
  }

  return {
    name:
      meta.name ||
      data.name ||
      "JSON Repository",

    format: "json",

    extensions
  };
}

function extractJsonExtensions(data) {
  if (Array.isArray(data)) {
    return normalizeExtensionArray(data);
  }

  if (!data || typeof data !== "object") {
    return [];
  }

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
      const result =
        normalizeExtensionArray(candidate);

      if (result.length) {
        return result;
      }
    }
  }

  return [];
}

function normalizeExtensionArray(array) {
  return array
    .filter(
      item =>
        item &&
        typeof item === "object"
    )
    .map((item, index) => ({
      id: String(
        item.pkg ||
        item.package ||
        item.id ||
        `extension-${index}`
      ),

      name: String(
        item.name ||
        item.title ||
        item.label ||
        item.pkg ||
        "Unnamed Extension"
      ),

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

      url: String(
        item.url ||
        item.sourceUrl ||
        item.website ||
        ""
      ),

      icon: String(
        item.icon ||
        item.iconUrl ||
        ""
      ),

      version: String(
        item.version ||
        item.versionName ||
        item.versionCode ||
        ""
      )
    }));
}

/* =========================
   SMART REPOSITORY LOADER
========================= */

async function loadRepositoryIndex(url, meta = {}) {
  const normalized = normalizeRepoUrl(url);

  /*
    repo.json / JSON first
  */

  if (
    normalized.endsWith(".json") ||
    normalized.includes("index.json")
  ) {
    return loadJsonIndex(
      normalized,
      meta
    );
  }

  /*
    Protobuf
  */

  if (
    normalized.endsWith(".pb") ||
    normalized.includes("index.pb")
  ) {
    return loadProtobufRepository(
      normalized
    );
  }

  /*
    Try JSON first.
  */

  try {
    return await loadJsonIndex(
      normalized,
      meta
    );
  } catch {}

  /*
    Then protobuf.
  */

  return loadProtobufRepository(
    normalized
  );
}

/* =========================
   PUBLIC REPOSITORY API
========================= */

app.get(
  "/api/repository",
  async (req, res) => {
    const rawUrl =
      String(req.query.url || "").trim();

    if (!rawUrl) {
      return res.status(400).json({
        error: "Missing repository URL"
      });
    }

    let url;

    try {
      url = new URL(rawUrl).href;
    } catch {
      return res.status(400).json({
        error: "Invalid repository URL"
      });
    }

    if (
      url.startsWith("http://") === false &&
      url.startsWith("https://") === false
    ) {
      return res.status(400).json({
        error: "Only HTTP and HTTPS repositories are supported"
      });
    }

    try {
      const result =
        await loadRepositoryIndex(url);

      res.json({
        ok: true,
        repository: {
          url,
          name: result.name,
          format: result.format
        },
        extensions: result.extensions
      });
    } catch (error) {
      res.status(502).json({
        ok: false,
        error:
          error.message ||
          "Could not read repository"
      });
    }
  }
);

/* =========================
   404
========================= */

app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    path: req.path
  });
});

/* =========================
   START
========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Zyomira backend running on port ${PORT}`
    );
  }
);