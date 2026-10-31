/**
 * Cross-platform path utilities for agentsmith.
 */

import { homedir } from "node:os";
import { join, resolve, relative, sep } from "node:path";
import { lstatSync } from "node:fs";

/** Root of the agentsmith cache directory. */
export function cacheRoot(): string {
    return process.env.AGENTSMITH_HOME || join(homedir(), ".agentsmith");
}

/** Root of the legacy vscode-copilot-sync cache directory. */
export function legacyCacheRoot(): string {
    return (
        process.env.AWESOME_COPILOT_HOME || join(homedir(), ".awesome-copilot")
    );
}

/** Path to the local awesome-copilot git checkout. */
export function awesomeCopilotRoot(): string {
    return join(cacheRoot(), "sources", "awesome-copilot");
}

/** Path to the catalogue JSON file. */
export function cataloguePath(): string {
    return join(cacheRoot(), "catalogue.json");
}

/** Path to the manifest JSON file. */
export function manifestPath(): string {
    return join(cacheRoot(), "manifest.json");
}

/** Path to the subscriptions JSON file. */
export function subscriptionsPath(): string {
    return join(cacheRoot(), "subscriptions.json");
}

/**
 * Asserts that a target path resides strictly within an authorised base directory.
 * Guards against path traversal attacks (e.g. '../' or absolute path escaping).
 * Throws if the path escapes the base, equals the base (unless allowEqual), or traverses a symlink.
 */
export function assertPathWithin(
    targetPath: string,
    baseDir: string,
    allowEqual = false
): void {
    const resolvedTarget = resolve(targetPath);
    const resolvedBase = resolve(baseDir);

    const rel = relative(resolvedBase, resolvedTarget);

    const isEqual = rel === "";
    const isOutside = rel.startsWith("..") || resolve(rel) === rel; // absolute path means it escaped

    if (isOutside || (isEqual && !allowEqual)) {
        throw new Error(
            `Security: path '${resolvedTarget}' traverses outside authorised directory '${resolvedBase}'.`
        );
    }

    // Walk each path segment and reject symlinks / reparse points
    if (!isEqual) {
        const segments = rel.split(sep);
        let current = resolvedBase;
        for (const segment of segments) {
            if (!segment || segment === ".") continue;
            current = join(current, segment);
            try {
                const stat = lstatSync(current);
                if (stat.isSymbolicLink()) {
                    throw new Error(
                        `Security: path '${resolvedTarget}' traverses a symbolic link at '${current}'.`
                    );
                }
            } catch (err) {
                // Path segment doesn't exist yet — that's fine, it will be created
                if ((err as NodeJS.ErrnoException).code === "ENOENT") continue;
                throw err;
            }
        }
    }
}
