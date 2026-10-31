/**
 * Antigravity target adapter.
 * Repo scope: .agents/
 * User scope: ~/.gemini/config/
 */

import { homedir } from "node:os";
import { join } from "node:path";
import type { AssetType, Scope } from "../types.js";
import { assertPathWithin } from "../utils/paths.js";
import {
    parseFrontmatter,
    serialiseFrontmatter,
} from "../utils/frontmatter.js";
import type { AdaptationResult } from "./vscode.js";

export function resolveAntigravityBaseDir(
    scope: Scope,
    cwd: string = process.cwd(),
    home: string = homedir()
): string {
    return scope === "repo"
        ? join(cwd, ".agents")
        : join(home, ".gemini", "config");
}

export function resolveAntigravityTargetPath(
    assetId: string,
    type: AssetType,
    scope: Scope,
    cwd: string = process.cwd(),
    home: string = homedir()
): string | null {
    const baseDir = resolveAntigravityBaseDir(scope, cwd, home);
    let targetPath: string;

    switch (type) {
        case "instruction":
        case "rule":
            targetPath = join(baseDir, "rules", `${assetId}.md`);
            break;
        case "agent":
            targetPath = join(
                baseDir,
                "plugins",
                assetId,
                "agents",
                `${assetId}.md`
            );
            break;
        case "skill":
            targetPath = join(baseDir, "plugins", assetId, "skills", assetId);
            break;
        default:
            return null;
    }

    assertPathWithin(targetPath, baseDir);
    return targetPath;
}

export function adaptForAntigravity(
    content: string,
    type: AssetType
): AdaptationResult {
    if (
        type !== "instruction" &&
        type !== "rule" &&
        type !== "agent" &&
        type !== "skill"
    ) {
        return {
            outcome: "unsupported",
            content,
            adaptations: [],
            reason: `Asset type '${type}' is not supported by the Antigravity target adapter.`,
        };
    }

    if (type === "skill") {
        return {
            outcome: "native",
            content,
            adaptations: [],
        };
    }

    const { attributes, body, hasFrontmatter } = parseFrontmatter(content);

    if (type === "agent") {
        if (!hasFrontmatter) {
            return { outcome: "native", content, adaptations: [] };
        }
        const updated = { ...attributes };
        const adaptations: string[] = [];
        for (const field of ["chat-tools", "handoffs", "target"]) {
            if (updated[field] !== undefined) {
                delete updated[field];
                adaptations.push(`omitted ${field}`);
            }
        }
        if (adaptations.length > 0) {
            return {
                outcome: "adapted",
                content: serialiseFrontmatter(updated, body),
                adaptations,
            };
        }
        return { outcome: "native", content, adaptations: [] };
    }

    // instruction / rule -> Antigravity requires `trigger` frontmatter
    const updated = { ...attributes };
    const adaptations: string[] = [];

    if (updated.trigger !== undefined) {
        return {
            outcome: "native",
            content,
            adaptations: [],
        };
    }

    if (updated.applyTo !== undefined) {
        const applyTo = String(updated.applyTo).trim();
        delete updated.applyTo;
        if (
            !applyTo ||
            applyTo === "**" ||
            applyTo === "*" ||
            applyTo === "**/*"
        ) {
            updated.trigger = "always_on";
            adaptations.push("applyTo -> trigger: always_on");
        } else {
            updated.trigger = "glob";
            updated.globs = applyTo;
            adaptations.push(`applyTo -> trigger: glob, globs: ${applyTo}`);
        }
    } else if (updated.inclusion !== undefined) {
        const pattern =
            typeof updated.fileMatchPattern === "string"
                ? updated.fileMatchPattern.trim()
                : "";
        delete updated.inclusion;
        delete updated.fileMatchPattern;
        if (pattern && pattern !== "**" && pattern !== "*") {
            updated.trigger = "glob";
            updated.globs = pattern;
            adaptations.push(`inclusion -> trigger: glob, globs: ${pattern}`);
        } else {
            updated.trigger = "always_on";
            adaptations.push("inclusion -> trigger: always_on");
        }
    } else {
        updated.trigger = "always_on";
        adaptations.push("added trigger: always_on");
    }

    return {
        outcome: "adapted",
        content: serialiseFrontmatter(updated, body),
        adaptations,
    };
}
