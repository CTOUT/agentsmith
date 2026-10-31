/**
 * Asset removal lifecycle.
 */

import { existsSync, readdirSync, rmSync, rmdirSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
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

/**
 * Removes an installed asset and its subscription record.
 */
export function removeAsset(
    assetId: string,
    options: RemoveOptions
): OperationResult {
    const { target, scope, dryRun = false, cwd, home } = options;
    const adapter = getTargetAdapter(target);
    const baseDir = adapter.resolveBaseDir(scope, cwd, home);
    const subscription = findSubscription(assetId, target, scope, baseDir);

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
