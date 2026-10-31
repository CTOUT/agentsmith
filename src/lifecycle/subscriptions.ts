/**
 * Subscription state management and status calculation (~/.agentsmith/subscriptions.json).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import type {
    AssetStatus,
    ManifestEntry,
    Scope,
    Subscription,
    Target,
} from "../types.js";
import { cacheRoot, subscriptionsPath } from "../utils/paths.js";
import { hashAssetPath } from "./hash.js";
import { loadManifest } from "../sources/awesome-copilot.js";

function isSameOrWithinPath(
    installedPath: string,
    constraintPath: string
): boolean {
    const resolvedInstalled = resolve(installedPath);
    const resolvedConstraint = resolve(constraintPath);
    if (resolvedInstalled === resolvedConstraint) return true;
    const rel = relative(resolvedConstraint, resolvedInstalled);
    return rel !== "" && !rel.startsWith("..") && resolve(rel) !== rel;
}

/**
 * Loads all subscription records from ~/.agentsmith/subscriptions.json.
 */
export function loadSubscriptions(): Subscription[] {
    const file = subscriptionsPath();
    if (!existsSync(file)) return [];
    return JSON.parse(readFileSync(file, "utf-8")) as Subscription[];
}

/**
 * Persists subscription records to ~/.agentsmith/subscriptions.json.
 */
export function saveSubscriptions(subscriptions: Subscription[]): void {
    mkdirSync(cacheRoot(), { recursive: true });
    writeFileSync(
        subscriptionsPath(),
        JSON.stringify(subscriptions, null, 2) + "\n",
        "utf-8"
    );
}

/**
 * Finds an existing subscription matching (id, target, scope) and optional path constraint.
 */
export function findSubscription(
    id: string,
    target: Target,
    scope: Scope,
    installedPathOrBaseDir?: string
): Subscription | undefined {
    const subscriptions = loadSubscriptions();
    return subscriptions.find(
        (s) =>
            s.id === id &&
            s.target === target &&
            s.scope === scope &&
            (!installedPathOrBaseDir ||
                isSameOrWithinPath(s.installedPath, installedPathOrBaseDir))
    );
}

/**
 * Inserts or updates a subscription record in ~/.agentsmith/subscriptions.json.
 */
export function upsertSubscription(sub: Subscription): void {
    const subscriptions = loadSubscriptions();
    const resolvedInstalled = resolve(sub.installedPath);
    const index = subscriptions.findIndex(
        (s) =>
            s.id === sub.id &&
            s.target === sub.target &&
            s.scope === sub.scope &&
            (sub.scope === "user" ||
                resolve(s.installedPath) === resolvedInstalled)
    );
    if (index >= 0) {
        subscriptions[index] = sub;
    } else {
        subscriptions.push(sub);
    }
    saveSubscriptions(subscriptions);
}

/**
 * Removes a subscription record by (id, target, scope) and optional path constraint. Returns true if one was removed.
 */
export function removeSubscriptionRecord(
    id: string,
    target: Target,
    scope: Scope,
    installedPathOrBaseDir?: string
): boolean {
    const subscriptions = loadSubscriptions();
    const filtered = subscriptions.filter(
        (s) =>
            !(
                s.id === id &&
                s.target === target &&
                s.scope === scope &&
                (!installedPathOrBaseDir ||
                    isSameOrWithinPath(s.installedPath, installedPathOrBaseDir))
            )
    );
    if (filtered.length === subscriptions.length) {
        return false;
    }
    saveSubscriptions(filtered);
    return true;
}

/**
 * Computes the runtime status of a single subscription (existence, local edits, upstream updates).
 */
export function computeAssetStatus(
    subscription: Subscription,
    manifest: ManifestEntry[] = loadManifest()
): AssetStatus {
    const exists = existsSync(subscription.installedPath);
    let locallyModified = false;

    if (exists) {
        try {
            const currentHash = hashAssetPath(subscription.installedPath);
            locallyModified = currentHash !== subscription.installedHash;
        } catch {
            locallyModified = false;
        }
    }

    const upstream = manifest.find((m) => m.id === subscription.id);
    const updateAvailable = Boolean(
        upstream && upstream.hash !== subscription.sourceHash
    );

    return {
        subscription,
        exists,
        locallyModified,
        updateAvailable,
        upstreamHash: upstream?.hash,
    };
}

/**
 * Returns statuses for all subscriptions, optionally filtered by target and/or scope.
 */
export function listAssetStatuses(filter?: {
    target?: Target;
    scope?: Scope;
}): AssetStatus[] {
    const subscriptions = loadSubscriptions();
    const manifest = loadManifest();

    return subscriptions
        .filter((s) => {
            if (filter?.target && s.target !== filter.target) return false;
            if (filter?.scope && s.scope !== filter.scope) return false;
            return true;
        })
        .map((s) => computeAssetStatus(s, manifest));
}
