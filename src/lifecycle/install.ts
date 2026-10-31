/**
 * Asset installation lifecycle.
 */

import {
    cpSync,
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import type { OperationResult, Scope, Target } from "../types.js";
import { getTargetAdapter } from "../targets/index.js";
import { loadManifest } from "../sources/awesome-copilot.js";
import { hashAssetPath, hashString } from "./hash.js";
import {
    computeAssetStatus,
    findSubscription,
    upsertSubscription,
} from "./subscriptions.js";
import { assertPathWithin } from "../utils/paths.js";

export interface InstallOptions {
    target: Target;
    scope: Scope;
    dryRun?: boolean;
    force?: boolean;
    cwd?: string;
    home?: string;
}

/**
 * Installs a single asset from the local cache into the specified target and scope.
 */
export function installAsset(
    assetId: string,
    options: InstallOptions
): OperationResult {
    const { target, scope, dryRun = false, force = false, cwd, home } = options;
    const manifest = loadManifest();
    const entry = manifest.find((m) => m.id === assetId);

    if (!entry) {
        return {
            id: assetId,
            target,
            scope,
            success: false,
            action: "failed",
            reason: `Asset '${assetId}' not found in local cache. Run 'agentsmith sync' first.`,
        };
    }

    if (!existsSync(entry.localPath)) {
        return {
            id: assetId,
            target,
            scope,
            success: false,
            action: "failed",
            reason: `Cached source file missing at '${entry.localPath}'. Run 'agentsmith sync' to repair.`,
        };
    }

    const adapter = getTargetAdapter(target);
    let targetPath: string | null;
    try {
        targetPath = adapter.resolveTargetPath(
            entry.id,
            entry.type,
            scope,
            cwd,
            home
        );
    } catch (err) {
        return {
            id: assetId,
            target,
            scope,
            success: false,
            action: "failed",
            reason: (err as Error).message,
        };
    }

    if (!targetPath) {
        return {
            id: assetId,
            target,
            scope,
            success: false,
            action: "skipped",
            reason: `Asset type '${entry.type}' is not supported by target '${target}'.`,
        };
    }

    const baseDir = adapter.resolveBaseDir(scope, cwd, home);
    assertPathWithin(targetPath, baseDir);

    const existing = findSubscription(entry.id, target, scope, targetPath);
    if (existing && !force) {
        const status = computeAssetStatus(existing, manifest);
        if (status.locallyModified) {
            return {
                id: assetId,
                target,
                scope,
                success: false,
                action: "skipped",
                reason: `Local modifications detected at '${existing.installedPath}'. Pass --force to overwrite.`,
            };
        }
    }

    const isDir = statSync(entry.localPath).isDirectory();
    const now = new Date().toISOString();

    if (isDir) {
        if (!existing && !force && existsSync(targetPath)) {
            try {
                if (hashAssetPath(targetPath) !== entry.hash) {
                    return {
                        id: assetId,
                        target,
                        scope,
                        success: false,
                        action: "skipped",
                        reason: `Existing untracked asset detected at '${targetPath}'. Pass --force to overwrite.`,
                    };
                }
            } catch {
                // Ignore hash failure and allow install
            }
        }

        if (!dryRun) {
            if (existsSync(targetPath)) {
                rmSync(targetPath, { recursive: true, force: true });
            }
            mkdirSync(dirname(targetPath), { recursive: true });
            cpSync(entry.localPath, targetPath, {
                recursive: true,
                force: true,
            });
            const installedHash = hashAssetPath(targetPath);
            upsertSubscription({
                id: entry.id,
                type: entry.type,
                target,
                scope,
                installedPath: targetPath,
                installedHash,
                sourceHash: entry.hash,
                installedAt: existing?.installedAt ?? now,
                updatedAt: now,
            });
        }

        return {
            id: entry.id,
            target,
            scope,
            success: true,
            action: existing ? "updated" : "installed",
            adapted: false,
            adaptations: [],
        };
    }

    const rawContent = readFileSync(entry.localPath, "utf-8");
    const adaptation = adapter.adaptContent(rawContent, entry.type);

    if (adaptation.outcome === "unsupported") {
        return {
            id: entry.id,
            target,
            scope,
            success: false,
            action: "skipped",
            reason: adaptation.reason ?? "Unsupported asset format.",
        };
    }

    if (!existing && !force && existsSync(targetPath)) {
        try {
            if (hashAssetPath(targetPath) !== hashString(adaptation.content)) {
                return {
                    id: assetId,
                    target,
                    scope,
                    success: false,
                    action: "skipped",
                    reason: `Existing untracked file detected at '${targetPath}'. Pass --force to overwrite.`,
                };
            }
        } catch {
            // Ignore hash failure and allow install
        }
    }

    if (!dryRun) {
        mkdirSync(dirname(targetPath), { recursive: true });
        writeFileSync(targetPath, adaptation.content, "utf-8");
        const installedHash = hashAssetPath(targetPath);
        upsertSubscription({
            id: entry.id,
            type: entry.type,
            target,
            scope,
            installedPath: targetPath,
            installedHash,
            sourceHash: entry.hash,
            installedAt: existing?.installedAt ?? now,
            updatedAt: now,
        });
    }

    return {
        id: entry.id,
        target,
        scope,
        success: true,
        action: existing ? "updated" : "installed",
        adapted: adaptation.outcome === "adapted",
        adaptations: adaptation.adaptations,
    };
}
