import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile("app.js", "utf8");
const statusStart = app.indexOf("function updateConnectionStatus()");
assert.notEqual(statusStart, -1, "connection status handler exists");
const statusEnd = app.indexOf("\nfunction showAuthScreen()", statusStart);
assert.notEqual(statusEnd, -1, "connection status handler has a stable boundary");
const handler = app.slice(statusStart, statusEnd);

assert.match(handler, /navigator\.onLine/, "device connectivity is read from navigator.onLine");
assert.match(handler, /Internetverbindung verfügbar/, "online state is labelled as connectivity");
assert.match(handler, /Internetverbindung nicht verfügbar/, "offline state is labelled as connectivity");
assert.doesNotMatch(handler, /Benutzer online|Benutzer offline/, "network connectivity must not claim scout presence");

console.log("PFMS connection status smoke tests passed: network state is not misrepresented as user presence.");
