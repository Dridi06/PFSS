import { access, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const outputDirectory = resolve(repositoryRoot, "dist");

const publicFiles = [
  "index.html",
  "connection-test.html",
  "rechtliches.html",
  "styles.css",
  "pfms-auth-executive.css",
  "scout-workspace.css",
  "PFSS_Black_Gold_Design_Update.css",
  "pfms-design-system.css",
  "app.js",
  "pfms-role-workflows.js",
  "scout-workspace.js",
  "pfms-logo.svg",
  "pfms-welcome.webp"
];

function readSupabaseBuildConfig() {
  const target = process.env.PFMS_BUILD_TARGET || "development";
  if (target === "ci") {
    return {
      supabaseUrl: "https://ci-placeholder.supabase.co",
      supabaseKey: "sb_publishable_ci-placeholder",
      projectRef: "ci-placeholder",
      buildTarget: "ci"
    };
  }

  if (!["development", "staging"].includes(target)) {
    throw new Error("Unsupported PFMS_BUILD_TARGET: " + target);
  }

  const supabaseUrl = (process.env.PFSS_SUPABASE_URL || "").trim();
  const supabaseKey = (process.env.PFSS_SUPABASE_KEY || "").trim();
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("PFSS_SUPABASE_URL and PFSS_SUPABASE_KEY are required for " + target + " builds.");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error("PFSS_SUPABASE_URL must be a valid HTTPS Supabase project URL.");
  }
  if (
    parsedUrl.protocol !== "https:" ||
    !/^[a-z0-9]{20}\.supabase\.co$/.test(parsedUrl.hostname) ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.port ||
    parsedUrl.pathname !== "/" ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error("PFSS_SUPABASE_URL must be the exact HTTPS origin of a Supabase project, without credentials, port, path, query or fragment.");
  }

  let keyIsPublic = supabaseKey.startsWith("sb_publishable_");
  if (!keyIsPublic && supabaseKey.split(".").length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(supabaseKey.split(".")[1], "base64url").toString("utf8"));
      keyIsPublic = payload.role === "anon";
    } catch {
      keyIsPublic = false;
    }
  }
  if (!keyIsPublic || supabaseKey.startsWith("sb_secret_")) {
    throw new Error("PFSS_SUPABASE_KEY must be a publishable/anon key. Secret and service-role keys are forbidden in browser builds.");
  }

  let projectRef = "";
  if (target === "staging") {
    const approvedStagingProjectRef = "oolvpbzbqiojioazsoun";
    projectRef = (process.env.PFMS_STAGING_PROJECT_REF || "").trim();
    if (projectRef !== approvedStagingProjectRef) {
      throw new Error("PFMS_STAGING_PROJECT_REF does not match the approved dedicated Staging project.");
    }
    if (!/^[a-z0-9]{20}$/.test(projectRef)) {
      throw new Error("PFMS_STAGING_PROJECT_REF must be the exact 20-character Staging project reference.");
    }
    if (parsedUrl.hostname !== projectRef + ".supabase.co") {
      throw new Error("Staging URL does not match PFMS_STAGING_PROJECT_REF. Build stopped to prevent cross-environment deployment.");
    }
  }

  return { supabaseUrl, supabaseKey, projectRef, buildTarget: target };
}

const runtimeConfig = readSupabaseBuildConfig();


await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

await writeFile(
  resolve(outputDirectory, "pfms-config.js"),
  "window.PFMS_CONFIG = Object.freeze(" + JSON.stringify(runtimeConfig) + ");\n",
  "utf8"
);

for (const relativePath of publicFiles) {
  const targetPath = resolve(outputDirectory, relativePath);

  // Reassemble the exact user-supplied login artwork from small UTF-8 Git blobs.
  // This avoids truncation of large binary payloads in repository content uploads.
  if (relativePath === "pfms-welcome.webp") {
    const encodedParts = [];
    for (let part = 1; part <= 13; part += 1) {
      const partPath = resolve(
        repositoryRoot,
        "pfms-welcome-data",
        `part-${String(part).padStart(2, "0")}.txt`
      );
      const encoded = (await readFile(partPath, "utf8")).trim();
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
        throw new Error(`PFMS welcome artwork part ${part} contains invalid base64 data.`);
      }
      encodedParts.push(encoded);
    }

    const encodedArtwork = encodedParts.join("");
    if (encodedArtwork.length !== 57912 || encodedArtwork.length % 4 !== 0) {
      throw new Error("PFMS welcome artwork is incomplete: encoded length does not match the verified source.");
    }

    const imageBytes = Buffer.from(encodedArtwork, "base64");
    const isWebP =
      imageBytes.length >= 20 &&
      imageBytes.toString("ascii", 0, 4) === "RIFF" &&
      imageBytes.readUInt32LE(4) === imageBytes.length - 8 &&
      imageBytes.toString("ascii", 8, 12) === "WEBP";

    let offset = 12;
    let hasImageChunk = false;
    while (isWebP && offset < imageBytes.length) {
      if (offset + 8 > imageBytes.length) break;
      const chunkType = imageBytes.toString("ascii", offset, offset + 4);
      const chunkLength = imageBytes.readUInt32LE(offset + 4);
      const chunkEnd = offset + 8 + chunkLength;
      if (chunkEnd > imageBytes.length) break;
      if (["VP8 ", "VP8L", "VP8X"].includes(chunkType)) hasImageChunk = true;
      offset = chunkEnd + (chunkLength % 2);
    }

    if (!isWebP || !hasImageChunk || offset !== imageBytes.length) {
      throw new Error("PFMS welcome artwork failed WebP signature and chunk-integrity checks.");
    }

    await writeFile(targetPath, imageBytes);
    continue;
  }

  const sourcePath = resolve(repositoryRoot, relativePath);
  try {
    await access(sourcePath);
  } catch {
    throw new Error(`Required public asset is missing: ${relativePath}`);
  }
  await copyFile(sourcePath, targetPath);
}

console.log(`PFMS static build complete: ${publicFiles.length + 1} public files written to dist/ (${runtimeConfig.buildTarget}).`);
