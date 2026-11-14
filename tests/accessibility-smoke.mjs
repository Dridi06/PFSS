import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pages = ["index.html", "rechtliches.html"];

function attributes(source) {
  const result = {};
  for (const match of source.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return result;
}

for (const page of pages) {
  const html = await readFile(page, "utf8");
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], [], page + " contains duplicate IDs");

  const labels = new Set(
    [...html.matchAll(/<label\b([^>]*)>/gi)]
      .map((match) => attributes(match[1]).for)
      .filter(Boolean)
  );

  for (const match of html.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
    const attrs = attributes(match[2]);
    if (attrs.type === "hidden" || "hidden" in attrs || attrs.type === "submit" || attrs.type === "button") continue;
    if (attrs.disabled) continue;

    const id = attrs.id;
    const wrapped = (() => {
      const start = match.index;
      const labelStart = html.lastIndexOf("<label", start);
      const labelEnd = html.lastIndexOf("</label>", start);
      return labelStart > labelEnd && html.indexOf("</label>", labelStart) > start;
    })();

    assert.ok(
      wrapped || (id && labels.has(id)) || attrs["aria-label"] || attrs["aria-labelledby"],
      page + " has a form control without an accessible label: " + match[0].slice(0, 180)
    );
  }

  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    const attrs = attributes(match[1]);
    assert.ok("alt" in attrs, page + " contains an image without an alt attribute");
  }

  for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const attrs = attributes(match[1]);
    const textContent = match[2].replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();
    const imageHasAlt = /<img\b[^>]*\balt=["'][^"']+["']/i.test(match[2]);
    assert.ok(
      textContent || imageHasAlt || attrs["aria-label"] || attrs["aria-labelledby"],
      page + " contains a button without an accessible name"
    );
  }

  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = attributes(match[1]);
    if (!attrs.href) continue;
    const textContent = match[2].replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();
    const imageHasAlt = /<img\b[^>]*\balt=["'][^"']+["']/i.test(match[2]);
    assert.ok(
      textContent || imageHasAlt || attrs["aria-label"] || attrs["aria-labelledby"],
      page + " contains a link without an accessible name: " + attrs.href
    );
  }
}

console.log("PFMS accessibility smoke tests passed: unique IDs, labelled form controls, image alternatives and named controls.");
