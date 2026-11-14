import { access, copyFile, mkdir, rm } from "node:fs/promises";
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

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

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

console.log(`PFMS static build complete: ${publicFiles.length} public files written to dist/.`);
