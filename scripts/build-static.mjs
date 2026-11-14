import { access, copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const outputDirectory = resolve(repositoryRoot, "dist");

const publicFiles = [
  "index.html",
  "rechtliches.html",
  "styles.css",
  "scout-workspace.css",
  "app.js",
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

  const parsedUrl = new URL(supabaseUrl);
  if (parsedUrl.protocol !== "https:" || !parsedUrl.hostname.endsWith(".supabase.co")) {
    throw new Error("PFSS_SUPABASE_URL must be an HTTPS Supabase project URL.");
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
    projectRef = (process.env.PFMS_STAGING_PROJECT_REF || "").trim();
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
  const sourcePath = resolve(repositoryRoot, relativePath);
  const targetPath = resolve(outputDirectory, relativePath);

  try {
    await access(sourcePath);
  } catch {
    throw new Error(`Required public asset is missing: ${relativePath}`);
  }

  await copyFile(sourcePath, targetPath);
}

console.log(`PFMS static build complete: ${publicFiles.length + 1} public files written to dist/ (${runtimeConfig.buildTarget}).`);
