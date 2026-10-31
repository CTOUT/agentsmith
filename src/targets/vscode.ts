/**
 * VS Code (Copilot) target adapter.
 * Repo scope: .github/
 * User scope: ~/.copilot/
 */

import { homedir } from "node:os";
import { join } from "node:path";
import type { AssetType, CompatibilityOutcome, Scope } from "../types.js";
import { assertPathWithin } from "../utils/paths.js";
import {
    parseFrontmatter,
    serialiseFrontmatter,
} from "../utils/frontmatter.js";

export interface AdaptationResult {
    outcome: CompatibilityOutcome;
    content: string;
    adaptations: string[];
    reason?: string;
}

export function resolveVscodeBaseDir(
    scope: Scope,
    cwd: string = process.cwd(),
    home: string = homedir()
): string {
    return scope === "repo" ? join(cwd, ".github") : join(home, ".copilot");
}

export function resolveVscodeTargetPath(
    assetId: string,
    type: AssetType,
    scope: Scope,
    cwd: string = process.cwd(),
    home: string = homedir()
): string | null {
    const baseDir = resolveVscodeBaseDir(scope, cwd, home);
    let targetPath: string;

    switch (type) {
        case "instruction":
        case "rule":
            targetPath = join(
                baseDir,
                "instructions",
                `${assetId}.instructions.md`
            );
            break;
        case "agent":
            targetPath = join(baseDir, "agents", `${assetId}.agent.md`);
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

export function adaptForVscode(
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
            reason: `Asset type '${type}' is not supported by the VS Code target adapter.`,
        };
    }

    if (type === "skill" || type === "agent") {
        return {
            outcome: "native",
            content,
            adaptations: [],
        };
    }

    const { attributes, body, hasFrontmatter } = parseFrontmatter(content);
    if (!hasFrontmatter) {
        return {
            outcome: "native",
            content,
            adaptations: [],
        };
    }

    const adaptations: string[] = [];
    const updated = { ...attributes };

    if (updated.inclusion !== undefined && updated.applyTo === undefined) {
        const pattern =
            typeof updated.fileMatchPattern === "string"
                ? updated.fileMatchPattern
                : "**";
        updated.applyTo = pattern;
        delete updated.inclusion;
        delete updated.fileMatchPattern;
        adaptations.push(`inclusion -> applyTo: ${pattern}`);
    }

    if (updated.trigger !== undefined && updated.applyTo === undefined) {
        const pattern =
            typeof updated.globs === "string" ? updated.globs : "**";
        updated.applyTo = pattern;
        delete updated.trigger;
        delete updated.globs;
        adaptations.push(`trigger -> applyTo: ${pattern}`);
    }

    if (adaptations.length > 0) {
        return {
            outcome: "adapted",
            content: serialiseFrontmatter(updated, body),
            adaptations,
        };
    }

    return {
        outcome: "native",
        content,
        adaptations: [],
    };
}
