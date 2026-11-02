/**
 * Asset removal lifecycle.
 */

import { existsSync, readdirSync, rmSync, rmdirSync } from "node:fs";
import { dirname, basename, resolve, sep } from "node:path";
import type { OperationResult, Scope, Target } from "../types.js";
import { getTargetAdapter } from "../targets/index.js";
import { assertPathWithin } from "../utils/paths.js";
import { findSubscription, removeSubscriptionRecord } from "./subscriptions.js";

export interface RemoveOptions {
    target: Target;
    scope: Scope;
    dryRun?: boolean;
    cwd?: string;
    home?: string;
}

function inferRepoCwdFromSubscription(
    subscription: import('../types.js').Subscription,
    target: import('../types.js').Target
): string | undefined {
    if (subscription.scope !== 'repo') return undefined
    const marker = target === 'vscode' ? '.github' : target === 'kiro' ? '.kiro' : '.agents'
    let current = resolve(subscription.installedPath)
    while (true) {
        const parent = dirname(current)
        if (parent === current) break
        if (basename(current) === marker) return parent
        current = parent
    }
    return undefined
}

/**
 * Removes an installed asset and its subscription record.
 */
export function removeAsset(
    assetId: string,
    options: RemoveOptions
): OperationResult {
    const { target, scope, dryRun = false, cwd, home } = options;

    // Reject asset IDs containing path separators or traversal sequences
    if (/[/\\]|\.\./.test(assetId)) {
        return {
            id: assetId,
            target: options.target,
            scope: options.scope,
            success: false,
            action: 'failed',
            reason: `Invalid asset ID '${assetId}': IDs must not contain path separators or traversal sequences.`,
        }
    }

    const adapter = getTargetAdapter(target);
    // Find subscription without path constraint first (search by id/target/scope only)
    const subscription = findSubscription(assetId, target, scope);

    if (!subscription) {
        return {
            id: assetId,
            target,
            scope,
            success: false,
            action: "failed",
            reason: `Asset '${assetId}' is not installed for target '${target}' (${scope} scope).`,
        };
    }

    const inferredCwd = inferRepoCwdFromSubscription(subscription, target) ?? cwd
    const baseDir = adapter.resolveBaseDir(scope, inferredCwd, home)

    try {
        assertPathWithin(subscription.installedPath, baseDir);
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

    if (!dryRun) {
        if (existsSync(subscription.installedPath)) {
            rmSync(subscription.installedPath, {
                recursive: true,
                force: true,
            });
            let parentDir = dirname(subscription.installedPath);
            const resolvedBase = resolve(baseDir);
            while (
                resolve(parentDir) === resolvedBase ||
                resolve(parentDir).startsWith(resolvedBase + sep)
            ) {
                try {
                    if (
                        existsSync(parentDir) &&
                        readdirSync(parentDir).length === 0
                    ) {
                        rmdirSync(parentDir);
                        parentDir = dirname(parentDir);
                    } else {
                        break;
                    }
                } catch {
                    break;
                }
            }
        }
        removeSubscriptionRecord(
            assetId,
            target,
            scope,
            subscription.installedPath
        );
    }

    return {
        id: assetId,
        target,
        scope,
        success: true,
        action: "removed",
    };
}
