/**
 * SHA-256 content and directory tree hashing for change detection.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Computes a deterministic SHA-256 hex digest of a string (normalising CRLF to LF).
 */
export function hashString(content: string): string {
    const normalised = content.replace(/\r\n/g, "\n");
    return createHash("sha256").update(normalised, "utf-8").digest("hex");
}

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

/**
 * Computes a deterministic SHA-256 hex digest of a single file.
 * Normalises CRLF to LF for UTF-8 text files; hashes raw bytes for binary files.
 */
export function hashFile(filePath: string): string {
    const buf = readFileSync(filePath);
    if (!buf.includes(0x00)) {
        try {
            const text = utf8Decoder.decode(buf);
            return hashString(text);
        } catch {
            // Invalid UTF-8 byte sequence — treat as binary
        }
    }
    return createHash("sha256").update(buf).digest("hex");
}

function collectFilesRecursive(dirPath: string, rootDir: string): string[] {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        if (entry.name === ".git") continue;
        const fullPath = join(dirPath, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectFilesRecursive(fullPath, rootDir));
        } else if (entry.isFile()) {
            files.push(fullPath);
        }
    }

    return files;
}

/**
 * Computes a deterministic SHA-256 hex digest of a directory tree.
 * Sorts relative POSIX paths alphabetically and combines path + file hash.
 */
export function hashDirectory(dirPath: string): string {
    const files = collectFilesRecursive(dirPath, dirPath);
    const items = files
        .map((fullPath) => {
            const relPosix = relative(dirPath, fullPath).split("\\").join("/");
            return { relPosix, fullPath };
        })
        .sort((a, b) => a.relPosix.localeCompare(b.relPosix));

    const hash = createHash("sha256");
    for (const item of items) {
        hash.update(`${item.relPosix}:${hashFile(item.fullPath)}\n`, "utf-8");
    }
    return hash.digest("hex");
}

/**
 * Computes the SHA-256 hash of either a file or a directory asset.
 */
export function hashAssetPath(targetPath: string): string {
    const stat = statSync(targetPath);
    if (stat.isDirectory()) {
        return hashDirectory(targetPath);
    }
    return hashFile(targetPath);
}
