#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, sep } from "node:path";
import type { Scope, Target } from "./types.js";
import {
    loadCatalogue,
    syncAwesomeCopilot,
} from "./sources/awesome-copilot.js";
import {
    getTargetAdapter,
    isValidScope,
    isValidTarget,
    normaliseTargetAssetType,
} from "./targets/index.js";
import { installAsset } from "./lifecycle/install.js";
import { updateSubscribedAssets } from "./lifecycle/update.js";
import { removeAsset } from "./lifecycle/remove.js";
import {
    listAssetStatuses,
    loadSubscriptions,
} from "./lifecycle/subscriptions.js";
import { getRecommendedAssetIds } from "./lifecycle/recommendations.js";
import { resolveTarget } from "./cli/detect.js";
import {
    formatStatusLine,
    promptSelectAssetsToInstall,
    promptSelectAssetsToRemove,
    promptSelectTarget,
} from "./cli/picker.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json
const pkg = JSON.parse(
    readFileSync(join(__dirname, "../package.json"), "utf-8")
) as {
    version: string;
};

function parseTargetOption(raw?: string): Target | undefined {
    if (!raw) return undefined;
    if (!isValidTarget(raw)) {
        console.error(
            `Error: Invalid target '${raw}'. Expected one of: vscode, kiro, antigravity.`
        );
        process.exit(1);
    }
    return raw;
}

function parseScopeOption(raw?: string): Scope {
    const val = raw ?? "repo";
    if (!isValidScope(val)) {
        console.error(
            `Error: Invalid scope '${val}'. Expected one of: repo, user.`
        );
        process.exit(1);
    }
    return val;
}

function isPromptCancellation(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const error = err as Error;
    return (
        error.name === "ExitPromptError" ||
        error.name === "AbortPromptError" ||
        error.name === "CancelPromptError" ||
        Boolean(
            error.message &&
            /force closed|sigint|canceled|cancelled/i.test(error.message)
        )
    );
}

async function resolveTargetForCommand(rawTarget?: string): Promise<Target> {
    const explicit = parseTargetOption(rawTarget);
    return resolveTarget(explicit, process.cwd(), promptSelectTarget);
}

const program = new Command();

program
    .name("agentsmith")
    .description(
        "Cross-environment agent asset manager — install, sync, and update agent skills, instructions, and agents across VS Code, Kiro, Antigravity, and more."
    )
    .version(pkg.version, "-v, --version", "Output the current version");

program
    .command("sync")
    .description(
        "Sync the awesome-copilot catalogue to the local cache (~/.agentsmith/)"
    )
    .option(
        "--dry-run",
        "Preview what would be synced without writing any files"
    )
    .option(
        "--force",
        "Skip safety checks (structural change and mass-removal detection)"
    )
    .action(async (options: { dryRun?: boolean; force?: boolean }) => {
        try {
            const result = await syncAwesomeCopilot({
                dryRun: Boolean(options.dryRun),
                force: Boolean(options.force),
            });

            if (result.legacyCacheDetected) {
                console.log(
                    "Notice: Detected legacy ~/.awesome-copilot/ directory. agentsmith uses ~/.agentsmith/ as its independent cache."
                );
            }

            const prefix = result.dryRun ? "[dry-run] " : "";
            console.log(
                `${prefix}Synced ${result.assets.length} assets from awesome-copilot (${result.added.length} added, ${result.updated.length} updated, ${result.removed.length} removed, ${result.unchanged.length} unchanged).`
            );
        } catch (err) {
            if (isPromptCancellation(err)) {
                console.log("\nOperation cancelled.");
                process.exit(0);
            }
            console.error(`Error: ${(err as Error).message}`);
            process.exit(1);
        }
    });

program
    .command("install [asset]")
    .description("Install an agent asset into the current environment")
    .option(
        "--target <target>",
        "Target environment: vscode | kiro | antigravity"
    )
    .option("--scope <scope>", "Installation scope: repo | user", "repo")
    .option(
        "-r, --recommended",
        "Install all recommended assets for this environment without prompting"
    )
    .option(
        "-s, --search <term>",
        "Filter assets by search term or fuzzy match"
    )
    .option(
        "-t, --type <type>",
        "Filter assets by type (instruction | steering | rule | agent | skill)"
    )
    .option(
        "--dry-run",
        "Preview what would be installed without writing any files"
    )
    .option("--force", "Overwrite locally modified files")
    .action(
        async (
            assetArg: string | undefined,
            options: {
                target?: string;
                scope?: string;
                recommended?: boolean;
                search?: string;
                type?: string;
                dryRun?: boolean;
                force?: boolean;
            }
        ) => {
            try {
                const scope = parseScopeOption(options.scope);
                const explicitTarget = parseTargetOption(options.target);
                const catalogue = loadCatalogue();

                if (!assetArg && catalogue.length === 0) {
                    console.error(
                        "Error: Local catalogue is empty. Run 'agentsmith sync' first."
                    );
                    process.exit(1);
                }

                const target = await resolveTarget(
                    explicitTarget,
                    process.cwd(),
                    promptSelectTarget
                );

                let typeFilter: import("./types.js").AssetType | undefined;
                if (options.type) {
                    typeFilter = normaliseTargetAssetType(options.type, target);
                    if (!typeFilter) {
                        console.error(
                            `Error: Invalid type '${options.type}'. Expected one of: instruction, steering, rule, agent, skill.`
                        );
                        process.exit(1);
                    }
                }

                let assetIds: string[] = [];
                const recommendedIds = getRecommendedAssetIds(
                    catalogue,
                    scope,
                    process.cwd()
                );

                if (assetArg) {
                    assetIds = [assetArg];
                } else if (options.recommended) {
                    let candidates = Array.from(recommendedIds);
                    if (typeFilter) {
                        const catById = new Map(
                            catalogue.map((e) => [e.id, e])
                        );
                        candidates = candidates.filter((id) => {
                            const e = catById.get(id);
                            return (
                                e?.type === typeFilter ||
                                (typeFilter === "instruction" &&
                                    e?.type === "rule")
                            );
                        });
                    }
                    if (candidates.length === 0) {
                        console.log(
                            `No recommended assets found for ${target}:${scope}.`
                        );
                        return;
                    }
                    assetIds = candidates;
                } else {
                    const baseDir = resolve(
                        getTargetAdapter(target).resolveBaseDir(scope)
                    );
                    const statuses = listAssetStatuses({
                        target,
                        scope,
                    }).filter(
                        (s) =>
                            scope === "user" ||
                            resolve(s.subscription.installedPath).startsWith(
                                baseDir + sep
                            )
                    );
                    assetIds = await promptSelectAssetsToInstall(
                        catalogue,
                        statuses,
                        target,
                        {
                            recommendedIds,
                            searchQuery: options.search,
                            typeFilter,
                            scope,
                        }
                    );
                    if (assetIds.length === 0) {
                        console.log("No assets selected.");
                        return;
                    }
                }

                const prefix = options.dryRun ? "[dry-run] " : "";
                let hasFailure = false;

                for (const id of assetIds) {
                    const res = installAsset(id, {
                        target,
                        scope,
                        dryRun: Boolean(options.dryRun),
                        force: Boolean(options.force),
                    });

                    if (res.success) {
                        const adaptNote =
                            res.adapted && res.adaptations?.length
                                ? ` [adapted: ${res.adaptations.join("; ")}]`
                                : "";
                        console.log(
                            `${prefix}${res.action} '${res.id}' -> ${res.target}:${res.scope}${adaptNote}`
                        );
                    } else {
                        hasFailure = true;
                        console.error(
                            `${prefix}${res.action} '${res.id}' (${res.target}:${res.scope}): ${res.reason ?? "Unknown error"}`
                        );
                    }
                }

                if (hasFailure) {
                    process.exit(1);
                }
            } catch (err) {
                if (isPromptCancellation(err)) {
                    console.log("\nOperation cancelled.");
                    process.exit(0);
                }
                console.error(`Error: ${(err as Error).message}`);
                process.exit(1);
            }
        }
    );

program
    .command("update")
    .description("Apply upstream updates to all subscribed assets")
    .option("--target <target>", "Limit to a specific target environment")
    .option("--scope <scope>", "Limit to a specific scope: repo | user")
    .option("--dry-run", "Preview updates without writing any files")
    .option("--force", "Apply all updates without prompting")
    .action(
        (options: {
            target?: string;
            scope?: string;
            dryRun?: boolean;
            force?: boolean;
        }) => {
            try {
                const target = parseTargetOption(options.target);
                const scope = options.scope
                    ? parseScopeOption(options.scope)
                    : undefined;

                const results = updateSubscribedAssets({
                    target,
                    scope,
                    dryRun: Boolean(options.dryRun),
                    force: Boolean(options.force),
                });

                if (results.length === 0) {
                    console.log("No subscribed assets found.");
                    return;
                }

                const prefix = options.dryRun ? "[dry-run] " : "";
                let hasFailure = false;
                for (const res of results) {
                    const detail = res.reason ? ` (${res.reason})` : "";
                    const msg = `${prefix}${res.action} '${res.id}' -> ${res.target}:${res.scope}${detail}`;
                    if (res.action === "failed") {
                        hasFailure = true;
                        console.error(msg);
                    } else {
                        console.log(msg);
                    }
                }
                if (hasFailure) {
                    process.exit(1);
                }
            } catch (err) {
                if (isPromptCancellation(err)) {
                    console.log("\nOperation cancelled.");
                    process.exit(0);
                }
                console.error(`Error: ${(err as Error).message}`);
                process.exit(1);
            }
        }
    );

program
    .command("remove [asset]")
    .description("Remove a subscribed asset from the current environment")
    .option(
        "--target <target>",
        "Target environment: vscode | kiro | antigravity"
    )
    .option("--scope <scope>", "Installation scope: repo | user", "repo")
    .option(
        "--dry-run",
        "Preview what would be removed without deleting any files"
    )
    .action(
        async (
            assetArg: string | undefined,
            options: { target?: string; scope?: string; dryRun?: boolean }
        ) => {
            try {
                const scope = parseScopeOption(options.scope);
                const target = await resolveTargetForCommand(options.target);

                let assetIds: string[] = [];
                if (assetArg) {
                    assetIds = [assetArg];
                } else {
                    const baseDir = resolve(
                        getTargetAdapter(target).resolveBaseDir(scope)
                    );
                    const subs = loadSubscriptions().filter(
                        (s) =>
                            s.target === target &&
                            s.scope === scope &&
                            (scope === "user" ||
                                resolve(s.installedPath).startsWith(
                                    baseDir + sep
                                ))
                    );
                    if (subs.length === 0) {
                        console.log(
                            `No installed assets found for ${target}:${scope}.`
                        );
                        return;
                    }
                    assetIds = await promptSelectAssetsToRemove(subs);
                    if (assetIds.length === 0) {
                        console.log("No assets selected.");
                        return;
                    }
                }

                const prefix = options.dryRun ? "[dry-run] " : "";
                let hasFailure = false;

                for (const id of assetIds) {
                    const res = removeAsset(id, {
                        target,
                        scope,
                        dryRun: Boolean(options.dryRun),
                    });

                    if (res.success) {
                        console.log(
                            `${prefix}removed '${res.id}' from ${res.target}:${res.scope}`
                        );
                    } else {
                        hasFailure = true;
                        console.error(
                            `${prefix}failed to remove '${res.id}': ${res.reason ?? "Unknown error"}`
                        );
                    }
                }

                if (hasFailure) {
                    process.exit(1);
                }
            } catch (err) {
                if (isPromptCancellation(err)) {
                    console.log("\nOperation cancelled.");
                    process.exit(0);
                }
                console.error(`Error: ${(err as Error).message}`);
                process.exit(1);
            }
        }
    );

program
    .command("list")
    .description("List installed assets and their status")
    .option("--target <target>", "Filter by target environment")
    .option("--scope <scope>", "Filter by scope: repo | user")
    .action((options: { target?: string; scope?: string }) => {
        try {
            const target = parseTargetOption(options.target);
            const scope = options.scope
                ? parseScopeOption(options.scope)
                : undefined;

            const statuses = listAssetStatuses({ target, scope });
            if (statuses.length === 0) {
                console.log("No installed assets found.");
                return;
            }

            const catalogue = loadCatalogue();
            const catById = new Map(catalogue.map((c) => [c.id, c]));

            for (const status of statuses) {
                console.log(
                    formatStatusLine(
                        status,
                        catById.get(status.subscription.id)
                    )
                );
            }
        } catch (err) {
            if (isPromptCancellation(err)) {
                console.log("\nOperation cancelled.");
                process.exit(0);
            }
            console.error(`Error: ${(err as Error).message}`);
            process.exit(1);
        }
    });

program.parse();
