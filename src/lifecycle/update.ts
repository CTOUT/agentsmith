/**
 * Upstream update lifecycle for subscribed assets.
 */

import { basename, dirname, resolve } from "node:path";
import type { OperationResult, Scope, Subscription, Target } from "../types.js";
import { listAssetStatuses } from "./subscriptions.js";
import { installAsset } from "./install.js";

export interface UpdateOptions {
    target?: Target;
    scope?: Scope;
    dryRun?: boolean;
    force?: boolean;
    cwd?: string;
    home?: string;
}

function inferRepoCwdFromSubscription(
    subscription: Subscription
): string | undefined {
    if (subscription.scope !== "repo") return undefined;
    const marker =
        subscription.target === "vscode"
            ? ".github"
            : subscription.target === "kiro"
              ? ".kiro"
              : ".agents";
    let current = resolve(subscription.installedPath);
    while (true) {
        const parent = dirname(current);
        if (parent === current) break;
        if (basename(current) === marker) {
            return parent;
        }
        current = parent;
    }
    return undefined;
}

/**
 * Checks all subscribed assets (filtered by target/scope) and applies upstream updates.
 */
export function updateSubscribedAssets(
    options: UpdateOptions = {}
): OperationResult[] {
    const statuses = listAssetStatuses({
        target: options.target,
        scope: options.scope,
    });
    const results: OperationResult[] = [];

    for (const status of statuses) {
        const { subscription } = status;

        if (status.locallyModified && !options.force) {
            results.push({
                id: subscription.id,
                target: subscription.target,
                scope: subscription.scope,
                success: false,
                action: "skipped",
                reason: `Local modifications detected at '${subscription.installedPath}'. Pass --force to overwrite.`,
            });
            continue;
        }

        if (status.exists && !status.updateAvailable && !options.force) {
            results.push({
                id: subscription.id,
                target: subscription.target,
                scope: subscription.scope,
                success: true,
                action: "skipped",
                reason: "Already up to date.",
            });
            continue;
        }

        const subCwd =
            inferRepoCwdFromSubscription(subscription) ?? options.cwd;

        const res = installAsset(subscription.id, {
            target: subscription.target,
            scope: subscription.scope,
            dryRun: options.dryRun,
            force: options.force,
            cwd: subCwd,
            home: options.home,
        });

        results.push({
            ...res,
            action: res.success ? "updated" : res.action,
        });
    }

    return results;
}
