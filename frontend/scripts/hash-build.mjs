#!/usr/bin/env node
// Renames build/bundle.js and build/bundle.css to include a content hash, then
// updates public/index.html to reference the hashed filenames. Run after a
// production rollup build so CloudFront can cache the bundle indefinitely
// (`Cache-Control: immutable`) and a redeploy is picked up by clients without
// a manual invalidation.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, renameSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const buildDir = "public/build";
const htmlPath = "public/index.html";

function purgeOldHashed(prefix, ext) {
    for (const name of readdirSync(buildDir)) {
        if (name.startsWith(`${prefix}-`) && name.endsWith(ext)) {
            unlinkSync(join(buildDir, name));
        }
    }
}

function hashFile(name) {
    const filePath = join(buildDir, name);
    const content = readFileSync(filePath);
    const hash = createHash("sha256").update(content).digest("hex").slice(0, 12);
    const dot = name.lastIndexOf(".");
    const newName = `${name.slice(0, dot)}-${hash}${name.slice(dot)}`;
    purgeOldHashed(name.slice(0, dot), name.slice(dot));
    renameSync(filePath, join(buildDir, newName));
    return newName;
}

const jsName = hashFile("bundle.js");
const cssName = hashFile("bundle.css");

let html = readFileSync(htmlPath, "utf8");
html = html.replace(/build\/bundle(-[a-f0-9]+)?\.js/g, `build/${jsName}`);
html = html.replace(/build\/bundle(-[a-f0-9]+)?\.css/g, `build/${cssName}`);
writeFileSync(htmlPath, html);

console.log(`hashed bundle: ${jsName}, ${cssName}`);
