import { access, copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, "dist-myscoutingdatabase");
const target = process.env.MYSCOUTINGDATABASE_BUILD_TARGET || "ci";
const expectedRef = "vxtybjaabtfhxfwctnyj";
let runtime = { url: "https://ci-placeholder.supabase.co", key: "sb_publishable_ci-placeholder", projectRef: "ci-placeholder", buildTarget: "ci" };

if (target === "staging") {
  const url = (process.env.MYSCOUTINGDATABASE_SUPABASE_URL || "").trim();
  const key = (process.env.MYSCOUTINGDATABASE_SUPABASE_KEY || "").trim();
  const ref = (process.env.MYSCOUTINGDATABASE_SUPABASE_PROJECT_REF || "").trim();
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error("MYSCOUTINGDATABASE_SUPABASE_URL must be a valid HTTPS Supabase URL."); }
  if (ref !== expectedRef || parsed.protocol !== "https:" || parsed.hostname !== ref + ".supabase.co" || parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || parsed.password || parsed.port) {
    throw new Error("myScoutingDatabase staging build blocked: project reference and URL must match the dedicated myScoutingDatabase project.");
  }
  const isPublic = key.startsWith("sb_publishable_") || (() => {
    try { return JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8")).role === "anon"; } catch { return false; }
  })();
  if (!isPublic || key.startsWith("sb_secret_")) throw new Error("MYSCOUTINGDATABASE_SUPABASE_KEY must be a publishable/anon key. Secret keys are forbidden.");
  runtime = { url, key, projectRef: ref, buildTarget: "staging" };
} else if (target !== "ci") {
  throw new Error("MYSCOUTINGDATABASE_BUILD_TARGET must be ci or staging.");
}

await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await writeFile(resolve(output,"config.js"),"window.MYSCOUTINGDATABASE_CONFIG = Object.freeze("+JSON.stringify(runtime)+");\n","utf8");
for (const file of ["index.html","styles.css","app.js"]) {
  const source = resolve(root,"asi",file);
  await access(source);
  await copyFile(source,resolve(output,file));
}
console.log("myScoutingDatabase isolated static build complete: "+target+" ("+runtime.projectRef+").");
