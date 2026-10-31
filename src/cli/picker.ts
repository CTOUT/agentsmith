/**
 * Interactive picker UI and status badge formatting using @inquirer/prompts.
 */

import { checkbox, input, select } from "@inquirer/prompts";
import { homedir } from "node:os";
import { relative } from "node:path";
import {
    ALL_TARGETS,
    getTargetAdapter,
    getTargetTypeLabel,
    getTargetTypePlural,
} from "../targets/index.js";
import type {
    AssetStatus,
    AssetType,
    CatalogueEntry,
    Scope,
    Subscription,
    Target,
} from "../types.js";

/**
 * Formats status badges for an asset according to the project specification:
 * ★  Recommended for this environment
 * [*] Already installed
 * [↑] Update available
 * [~] Locally modified since install
 * [!] Requires additional setup
 */
export function formatAssetBadges(options: {
    installed?: boolean;
    updateAvailable?: boolean;
    locallyModified?: boolean;
    requiresSetup?: boolean;
    recommended?: boolean;
}): string {
    const badges: string[] = [];

    if (options.recommended) badges.push("★");
    if (options.installed) badges.push("[*]");
    if (options.updateAvailable) badges.push("[↑]");
    if (options.locallyModified) badges.push("[~]");
    if (options.requiresSetup) badges.push("[!]");

    return badges.join(" ");
}

/**
 * Formats a single asset status row for `agentsmith list`.
 */
export function formatStatusLine(
    status: AssetStatus,
    catalogueEntry?: CatalogueEntry
): string {
    const { subscription } = status;
    const badgeStr = formatAssetBadges({
        installed: status.exists,
        updateAvailable: status.updateAvailable,
        locallyModified: status.locallyModified,
        requiresSetup: catalogueEntry?.requiresSetup,
    });

    const missingTag = status.exists ? "" : " [missing]";
    const prefix = badgeStr ? `${badgeStr} ` : "";
    const typeLabel = getTargetTypeLabel(
        subscription.type,
        subscription.target
    );
    return `${prefix}${subscription.id} (${typeLabel}) -> ${subscription.target}:${subscription.scope}${missingTag}`;
}

/**
 * Sanitises markdown descriptions by collapsing line breaks, list bullet markers,
 * and excess whitespace into a single clean line.
 */
export function cleanDescription(desc: string): string {
    return desc
        .replace(/\r?\n\s*[-*•+]\s*/g, " ")
        .replace(/\r?\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Truncates a string to fit within a fixed column width and pads it with trailing spaces.
 */
export function truncateAndPad(str: string, width: number): string {
    if (str.length > width) {
        return `${str.slice(0, Math.max(0, width - 1))}…`;
    }
    return str.padEnd(width);
}

/**
 * Centres a string within a fixed width by padding both sides with spaces.
 */
export function centreAndPad(str: string, width: number): string {
    if (str.length >= width) {
        return str;
    }
    const remaining = width - str.length;
    const padLeft = Math.floor(remaining / 2);
    const padRight = remaining - padLeft;
    return " ".repeat(padLeft) + str + " ".repeat(padRight);
}

/**
 * Resolves a human-friendly relative destination path for an asset within the target environment.
 */
export function getTargetDisplayPath(
    assetId: string,
    type: AssetType,
    target: Target,
    scope: Scope = "repo"
): string {
    const adapter = getTargetAdapter(target);
    const resolved = adapter.resolveTargetPath(assetId, type, scope);
    if (!resolved) return "";
    const cwd = process.cwd();
    const home = homedir();
    if (scope === "user" && resolved.startsWith(home)) {
        return `~${resolved.slice(home.length).replace(/\\/g, "/")}`;
    }
    const rel = relative(cwd, resolved).replace(/\\/g, "/");
    return rel;
}

const TECH_ALIASES: Record<string, readonly string[]> = {
    ts: ["typescript"],
    js: ["javascript"],
    py: ["python"],
    rb: ["ruby"],
    rs: ["rust"],
    cs: ["csharp", "dotnet"],
    tf: ["terraform"],
    k8s: ["kubernetes"],
    gh: ["github"],
};

function escapeRegExp(str: string): string {
    return str.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

/**
 * Filters and scores catalogue entries by search query matching on ID, title, description, tags, and target terms.
 */
export function filterCatalogueBySearch(
    catalogue: readonly CatalogueEntry[],
    query: string,
    target: Target
): CatalogueEntry[] {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [...catalogue];

    const tokens = trimmed.split(/\s+/).filter(Boolean);
    const scored: { entry: CatalogueEntry; score: number }[] = [];

    for (const entry of catalogue) {
        const idLower = entry.id.toLowerCase();
        const titleLower = entry.title.toLowerCase();
        const descLower = entry.description.toLowerCase();
        const idSegments = idLower.split(/[-_]/).filter(Boolean);
        const acronym = idSegments.map((s) => s[0]).join("");
        const targetTypeLabel = getTargetTypeLabel(
            entry.type,
            target
        ).toLowerCase();
        const targetTypePlural = getTargetTypePlural(
            entry.type,
            target
        ).toLowerCase();
        const canonicalType = entry.type.toLowerCase();
        const tags = entry.tags.map((t) => t.toLowerCase());

        let totalScore = 0;
        let allTokensMatch = true;

        for (const token of tokens) {
            let tokenScore = 0;
            const fullWordRegex = new RegExp(
                `\\b${escapeRegExp(token)}\\b`,
                "i"
            );
            const prefixWordRegex = new RegExp(
                `\\b${escapeRegExp(token)}`,
                "i"
            );

            // 1. ID exact, segment, or substring match
            if (idLower === token) {
                tokenScore += 100;
            } else if (idSegments.some((s) => s === token)) {
                tokenScore += 60;
            } else if (idSegments.some((s) => s.startsWith(token))) {
                tokenScore += 40;
            } else if (token.length > 2 && idLower.includes(token)) {
                tokenScore += 30;
            }

            // 2. Title word match
            if (fullWordRegex.test(titleLower)) {
                tokenScore += 50;
            } else if (prefixWordRegex.test(titleLower)) {
                tokenScore += 35;
            }

            // 3. Target terminology match
            if (
                token === targetTypeLabel ||
                token === targetTypePlural ||
                token === canonicalType ||
                (token === "instructions" && canonicalType === "instruction") ||
                (token === "rules" && canonicalType === "instruction") ||
                (token === "steering" && canonicalType === "instruction")
            ) {
                tokenScore += 40;
            }

            // 4. Tags match
            if (tags.some((t) => t === token)) {
                tokenScore += 45;
            } else if (
                tags.some((t) => token.length > 2 && t.includes(token))
            ) {
                tokenScore += 25;
            }

            // 5. Description match (word boundary required)
            if (fullWordRegex.test(descLower)) {
                tokenScore += 20;
            }

            // 6. Acronym exact match for short queries (e.g. 'tdd' -> 'test-driven-development')
            if (
                tokenScore === 0 &&
                token.length >= 2 &&
                token.length <= 4 &&
                acronym === token
            ) {
                tokenScore += 35;
            }

            // 7. Tech alias expansion (e.g. 'ts' -> 'typescript')
            if (tokenScore === 0 && TECH_ALIASES[token]) {
                for (const alias of TECH_ALIASES[token] ?? []) {
                    if (
                        idLower.includes(alias) ||
                        tags.includes(alias) ||
                        descLower.includes(alias)
                    ) {
                        tokenScore += 30;
                        break;
                    }
                }
            }

            if (tokenScore === 0) {
                allTokensMatch = false;
                break;
            }

            totalScore += tokenScore;
        }

        if (allTokensMatch && totalScore > 0) {
            scored.push({ entry, score: totalScore });
        }
    }

    scored.sort(
        (a, b) =>
            b.score - a.score || a.entry.title.localeCompare(b.entry.title)
    );
    return scored.map((s) => s.entry);
}

export interface PromptInstallOptions {
    recommendedIds?: Set<string>;
    searchQuery?: string;
    typeFilter?: AssetType;
    skipFilterMenu?: boolean;
    scope?: Scope;
}

function renderAssetCheckboxPicker(
    catalogue: CatalogueEntry[],
    target: Target,
    scope: Scope,
    statusById: Map<string, AssetStatus>,
    recommendedIds: Set<string>
): Promise<string[]> {
    // Sort: recommended first, then already-installed, then alphabetical by title
    const sortedCatalogue = [...catalogue].sort((a, b) => {
        const aRec = recommendedIds.has(a.id) ? 0 : 1;
        const bRec = recommendedIds.has(b.id) ? 0 : 1;
        if (aRec !== bRec) return aRec - bRec;

        const aInst = statusById.get(a.id)?.exists ? 0 : 1;
        const bInst = statusById.get(b.id)?.exists ? 0 : 1;
        if (aInst !== bInst) return aInst - bInst;

        return a.title.localeCompare(b.title);
    });

    const iconsWidth = 7;
    const typeWidth = 15;

    const header =
        "   " +
        centreAndPad("ICONS", iconsWidth) +
        " " +
        centreAndPad("TYPE", typeWidth) +
        " " +
        "ASSET NAME";

    const choices = sortedCatalogue.map((entry) => {
        const st = statusById.get(entry.id);
        const isRec = recommendedIds.has(entry.id);
        const badges = formatAssetBadges({
            installed: Boolean(st?.exists),
            updateAvailable: Boolean(st?.updateAvailable),
            locallyModified: Boolean(st?.locallyModified),
            requiresSetup: entry.requiresSetup,
            recommended: isRec,
        });

        const targetTypeLabel = getTargetTypeLabel(entry.type, target);
        const displayPath = getTargetDisplayPath(
            entry.id,
            entry.type,
            target,
            scope
        );

        const iconsCol = centreAndPad(badges, iconsWidth);
        const typeCol = centreAndPad(`[${targetTypeLabel}]`, typeWidth);
        const rowName = `${iconsCol} ${typeCol} ${entry.title}`;

        const sanitizedDesc = cleanDescription(entry.description);
        const descriptionLines = [
            `Target:      ${displayPath} (${target}:${scope})`,
            `Description: ${sanitizedDesc}`,
        ];

        return {
            name: rowName,
            value: entry.id,
            checked: isRec && !st?.exists,
            description: descriptionLines.join("\n"),
        };
    });

    const recCount = sortedCatalogue.filter((e) =>
        recommendedIds.has(e.id)
    ).length;
    const recNote = recCount > 0 ? ` (${recCount} recommended ★)` : "";

    return checkbox({
        message: `Select assets to install for ${target} (${scope} scope)${recNote}:`,
        choices,
        pageSize: 15,
        theme: {
            style: {
                message: (text: string, status: string) => {
                    if (status === "done") return text;
                    return `${text}\n${header}`;
                },
            },
        },
    });
}

/**
 * Prompts the user to select one or more assets from the catalogue to install.
 * Supports category filtering, fuzzy search, and target-specific terminology.
 */
export async function promptSelectAssetsToInstall(
    catalogue: CatalogueEntry[],
    statuses: AssetStatus[],
    target: Target,
    options: PromptInstallOptions | Set<string> = {}
): Promise<string[]> {
    const opts: PromptInstallOptions =
        options instanceof Set ? { recommendedIds: options } : options;
    const recommendedIds = opts.recommendedIds ?? new Set<string>();

    const currentScope = opts.scope ?? "repo";
    const scopeContext =
        currentScope === "user" ? "user profile" : "this repository";

    const statusById = new Map(
        statuses
            .filter((s) => s.subscription.target === target)
            .map((s) => [s.subscription.id, s])
    );

    // Direct search query flag passed via CLI
    if (opts.searchQuery) {
        const workingCatalogue = filterCatalogueBySearch(
            catalogue,
            opts.searchQuery,
            target
        );
        if (workingCatalogue.length === 0) {
            console.log(`No assets found matching '${opts.searchQuery}'.`);
            return [];
        }
        return renderAssetCheckboxPicker(
            workingCatalogue,
            target,
            currentScope,
            statusById,
            recommendedIds
        );
    }

    // Direct type filter flag passed via CLI
    if (opts.typeFilter) {
        const workingCatalogue = catalogue.filter(
            (e) =>
                e.type === opts.typeFilter ||
                (opts.typeFilter === "instruction" && e.type === "rule")
        );
        return renderAssetCheckboxPicker(
            workingCatalogue,
            target,
            currentScope,
            statusById,
            recommendedIds
        );
    }

    // Interactive navigation loop with Back / Cancel support
    while (true) {
        let workingCatalogue = [...catalogue];

        if (!opts.skipFilterMenu && catalogue.length > 25) {
            const instructionPlural = getTargetTypePlural(
                "instruction",
                target
            );
            const instructionCount = catalogue.filter(
                (e) => e.type === "instruction" || e.type === "rule"
            ).length;
            const agentCount = catalogue.filter(
                (e) => e.type === "agent"
            ).length;
            const skillCount = catalogue.filter(
                (e) => e.type === "skill"
            ).length;
            const recCount = catalogue.filter((e) =>
                recommendedIds.has(e.id)
            ).length;

            const filterMode = await select({
                message: `What would you like to install for ${target} (${scopeContext})?`,
                choices: [
                    ...(recCount > 0
                        ? [
                              {
                                  name: `★ Recommended for ${scopeContext} (${recCount} items)`,
                                  value: "recommended",
                              },
                          ]
                        : []),
                    {
                        name: `🔍 Search by keyword / fuzzy match...`,
                        value: "search",
                    },
                    {
                        name: `All ${instructionPlural} (${instructionCount} items)`,
                        value: "instruction",
                    },
                    {
                        name: `All agents (${agentCount} items)`,
                        value: "agent",
                    },
                    {
                        name: `All skills (${skillCount} items)`,
                        value: "skill",
                    },
                    {
                        name: `Browse everything (${catalogue.length} assets)`,
                        value: "all",
                    },
                    {
                        name: `✖ Cancel`,
                        value: "cancel",
                    },
                ],
            });

            if (filterMode === "cancel") {
                return [];
            }

            if (filterMode === "recommended") {
                workingCatalogue = catalogue.filter((e) =>
                    recommendedIds.has(e.id)
                );
            } else if (filterMode === "search") {
                const query = await input({
                    message: `Search assets (or press Enter to return):`,
                });
                if (!query.trim()) {
                    continue;
                }
                workingCatalogue = filterCatalogueBySearch(
                    catalogue,
                    query,
                    target
                );
                if (workingCatalogue.length === 0) {
                    console.log(`No assets found matching '${query}'.`);
                    continue;
                }
            } else if (filterMode === "instruction") {
                workingCatalogue = catalogue.filter(
                    (e) => e.type === "instruction" || e.type === "rule"
                );
            } else if (filterMode === "agent") {
                workingCatalogue = catalogue.filter((e) => e.type === "agent");
            } else if (filterMode === "skill") {
                workingCatalogue = catalogue.filter((e) => e.type === "skill");
            }
        }

        const selectedIds = await renderAssetCheckboxPicker(
            workingCatalogue,
            target,
            currentScope,
            statusById,
            recommendedIds
        );

        if (selectedIds.length > 0) {
            return selectedIds;
        }

        // If the user selected 0 items in interactive category mode, offer to return to menu or cancel
        if (!opts.skipFilterMenu && catalogue.length > 25) {
            const nextAction = await select({
                message: "No assets were selected. What would you like to do?",
                choices: [
                    { name: "← Back to category / search menu", value: "back" },
                    { name: "✖ Cancel installation", value: "cancel" },
                ],
            });
            if (nextAction === "back") {
                continue;
            }
        }

        return [];
    }
}

/**
 * Prompts the user to select installed subscriptions to remove.
 */
export async function promptSelectAssetsToRemove(
    subscriptions: Subscription[]
): Promise<string[]> {
    if (subscriptions.length === 0) return [];

    const typeWidth = 15;
    const header =
        "   " +
        centreAndPad("TYPE", typeWidth) +
        " " +
        truncateAndPad("ASSET ID", 28) +
        " " +
        "ENVIRONMENT";

    const choices = subscriptions.map((sub) => {
        const typeLabel = getTargetTypeLabel(sub.type, sub.target);
        const typeCol = centreAndPad(`[${typeLabel}]`, typeWidth);
        const idCol = truncateAndPad(sub.id, 28);
        const envCol = `${sub.target}:${sub.scope}`;

        return {
            name: `${typeCol} ${idCol} ${envCol}`,
            value: sub.id,
            description: `Target: ${sub.installedPath} (${sub.target}:${sub.scope})`,
        };
    });

    return checkbox({
        message: "Select installed assets to remove:",
        choices,
        pageSize: 15,
        theme: {
            style: {
                message: (text: string, status: string) => {
                    if (status === "done") return text;
                    return `${text}\n${header}`;
                },
            },
        },
    });
}

/**
 * Prompts the user to select a target environment when none or multiple are detected.
 */
export async function promptSelectTarget(
    targets: readonly Target[] = ALL_TARGETS
): Promise<Target> {
    const choices: { name: string; value: string }[] = (
        targets.length > 0 ? targets : ALL_TARGETS
    ).map((t) => ({
        name: t,
        value: t,
    }));
    choices.push({
        name: "✖ Cancel",
        value: "cancel",
    });
    const chosen = await select({
        message: "Select target environment:",
        choices,
    });
    if (chosen === "cancel") {
        const cancelErr = new Error("Prompt was cancelled");
        cancelErr.name = "CancelPromptError";
        throw cancelErr;
    }
    return chosen as Target;
}
