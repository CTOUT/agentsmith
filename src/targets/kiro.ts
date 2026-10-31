/**
 * Kiro target adapter.
 * Repo scope: .kiro/
 * User scope: ~/.kiro/
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

export function resolveKiroBaseDir(
    scope: Scope,
    cwd: string = process.cwd(),
    home: string = homedir()
): string {
    return scope === "repo" ? join(cwd, ".kiro") : join(home, ".kiro");
}

export function resolveKiroTargetPath(
    assetId: string,
    type: AssetType,
    scope: Scope,
    cwd: string = process.cwd(),
    home: string = homedir()
): string | null {
    const baseDir = resolveKiroBaseDir(scope, cwd, home);
    let targetPath: string;

    switch (type) {
        case "instruction":
        case "rule":
            targetPath = join(baseDir, "steering", `${assetId}.md`);
            break;
        case "agent":
            targetPath = join(baseDir, "agents", `${assetId}.md`);
            break;
        case "skill":
            targetPath = join(baseDir, "skills", assetId);
            break;
        default:
            return null;
    }

    assertPathWithin(targetPath, baseDir);
    return targetPath;
}

export function adaptForKiro(
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
            reason: `Asset type '${type}' is not supported by the Kiro target adapter.`,
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

    // instruction / rule -> Kiro steering requires `inclusion` frontmatter
    const updated = { ...attributes };
    const adaptations: string[] = [];

    if (updated.inclusion !== undefined) {
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
            updated.inclusion = "always";
            adaptations.push("applyTo -> inclusion: always");
        } else {
            updated.inclusion = "fileMatch";
            updated.fileMatchPattern = applyTo;
            adaptations.push(
                `applyTo -> inclusion: fileMatch, fileMatchPattern: ${applyTo}`
            );
        }
    } else if (updated.trigger !== undefined) {
        const globs =
            typeof updated.globs === "string" ? updated.globs.trim() : "";
        delete updated.trigger;
        delete updated.globs;
        if (globs && globs !== "**" && globs !== "*") {
            updated.inclusion = "fileMatch";
            updated.fileMatchPattern = globs;
            adaptations.push(
                `trigger -> inclusion: fileMatch, fileMatchPattern: ${globs}`
            );
        } else {
            updated.inclusion = "always";
            adaptations.push("trigger -> inclusion: always");
        }
    } else {
        updated.inclusion = "always";
        adaptations.push("added inclusion: always");
    }

    return {
        outcome: "adapted",
        content: serialiseFrontmatter(updated, body),
        adaptations,
    };
}
