/**
 * Source adapter for github/awesome-copilot.
 * Handles git clone/pull, asset discovery, frontmatter extraction,
 * safety checks (structural change & mass-removal detection), and cache writing.
 */

import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { simpleGit } from "simple-git";
import type {
    Asset,
    AssetType,
    CatalogueEntry,
    ManifestEntry,
} from "../types.js";
import {
    awesomeCopilotRoot,
    cacheRoot,
    cataloguePath,
    legacyCacheRoot,
    manifestPath,
} from "../utils/paths.js";
import { parseFrontmatter } from "../utils/frontmatter.js";
import { hashAssetPath } from "../lifecycle/hash.js";

export const AWESOME_COPILOT_REPO_URL =
    "https://github.com/github/awesome-copilot.git";
export const SOURCE_NAME = "awesome-copilot";
export const MASS_REMOVAL_THRESHOLD = 0.5;

export interface SyncOptions {
    dryRun?: boolean;
    force?: boolean;
    /** Override local git checkout directory (used for testing). */
    repoDir?: string;
    /** Override remote git URL (used for testing). */
    remoteUrl?: string;
    /** Skip git network clone/pull operations (used when repoDir is pre-populated). */
    skipGit?: boolean;
}

export interface SyncResult {
    assets: Asset[];
    added: string[];
    updated: string[];
    removed: string[];
    unchanged: string[];
    dryRun: boolean;
    legacyCacheDetected: boolean;
}

function stripAssetSuffix(filename: string): string {
    return filename
        .replace(/\.instructions\.md$/i, "")
        .replace(/\.agent\.md$/i, "")
        .replace(/\.chatmode\.md$/i, "")
        .replace(/\.prompt\.md$/i, "")
        .replace(/\.md$/i, "");
}

function humaniseSlug(slug: string): string {
    return slug
        .split(/[-_]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function extractHeadingAndSummary(body: string): {
    heading?: string;
    summary?: string;
} {
    const lines = body
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    let heading: string | undefined;
    let summary: string | undefined;

    for (const line of lines) {
        const h1Match = line.match(/^#\s+([^#].*)$/);
        if (h1Match) {
            if (!heading) {
                const candidate = h1Match[1]?.trim();
                if (candidate && !/^\d+\.\s/.test(candidate)) {
                    heading = candidate;
                }
            }
            continue;
        }
        if (line.startsWith("#")) {
            continue;
        }
        if (!summary) {
            summary = line;
            break;
        }
    }

    return { heading, summary };
}

function parseAssetMetadata(
    id: string,
    type: AssetType,
    localPath: string,
    isDirectory: boolean,
    markdownContent: string
): Asset {
    const { attributes, body } = parseFrontmatter(markdownContent);
    const { heading, summary } = extractHeadingAndSummary(body);

    const title =
        (typeof attributes.title === "string" && attributes.title.trim()) ||
        (typeof attributes.name === "string" && attributes.name.trim()) ||
        heading ||
        humaniseSlug(id);

    const rawDescription =
        (typeof attributes.description === "string" &&
            attributes.description.trim()) ||
        summary ||
        `${humaniseSlug(type)} asset for ${title}`;

    const description = rawDescription
        .replace(/\r?\n\s*[-*•+]\s*/g, " ")
        .replace(/\r?\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const rawTags = attributes.tags;
    const tags: string[] = Array.isArray(rawTags)
        ? rawTags.map((t) => String(t).trim()).filter(Boolean)
        : typeof rawTags === "string"
          ? rawTags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
          : [];

    const requiresSetup = Boolean(
        attributes.requiresSetup === true ||
        attributes.mcpServers !== undefined ||
        attributes.setup !== undefined ||
        /requires?\s+setup|API_KEY/i.test(body)
    );

    const hash = hashAssetPath(localPath);

    return {
        id,
        type,
        title,
        description,
        source: SOURCE_NAME,
        localPath,
        isDirectory,
        hash,
        requiresSetup,
        tags,
    };
}

/**
 * Scans a local awesome-copilot directory and returns all discovered canonical assets.
 */
export function scanAwesomeCopilotRepo(repoDir: string): Asset[] {
    if (!existsSync(repoDir)) {
        return [];
    }

    const assets: Asset[] = [];
    const seenIds = new Set<string>();

    const registerAsset = (asset: Asset) => {
        let candidateId = asset.id;
        if (seenIds.has(candidateId)) {
            candidateId = `${asset.type}-${asset.id}`;
        }
        let suffix = 2;
        while (seenIds.has(candidateId)) {
            candidateId = `${asset.type}-${asset.id}-${suffix}`;
            suffix++;
        }
        asset.id = candidateId;
        seenIds.add(asset.id);
        assets.push(asset);
    };

    // 1. Scan instructions/
    const instructionsDir = join(repoDir, "instructions");
    if (existsSync(instructionsDir)) {
        const entries = readdirSync(instructionsDir, {
            withFileTypes: true,
        }).sort((a, b) => a.name.localeCompare(b.name));
        for (const entry of entries) {
            if (
                !entry.isFile() ||
                !entry.name.endsWith(".md") ||
                entry.name.toLowerCase() === "readme.md"
            ) {
                continue;
            }
            const fullPath = join(instructionsDir, entry.name);
            const id = stripAssetSuffix(entry.name);
            const content = readFileSync(fullPath, "utf-8");
            registerAsset(
                parseAssetMetadata(id, "instruction", fullPath, false, content)
            );
        }
    }

    // 2. Scan agents/ and legacy chatmodes/
    for (const folder of ["agents", "chatmodes"]) {
        const agentsDir = join(repoDir, folder);
        if (!existsSync(agentsDir)) continue;
        const entries = readdirSync(agentsDir, { withFileTypes: true }).sort(
            (a, b) => a.name.localeCompare(b.name)
        );
        for (const entry of entries) {
            if (
                !entry.isFile() ||
                !entry.name.endsWith(".md") ||
                entry.name.toLowerCase() === "readme.md"
            ) {
                continue;
            }
            const fullPath = join(agentsDir, entry.name);
            const id = stripAssetSuffix(entry.name);
            const content = readFileSync(fullPath, "utf-8");
            registerAsset(
                parseAssetMetadata(id, "agent", fullPath, false, content)
            );
        }
    }

    // 3. Scan skills/
    const skillsDir = join(repoDir, "skills");
    if (existsSync(skillsDir)) {
        const entries = readdirSync(skillsDir, { withFileTypes: true }).sort(
            (a, b) => a.name.localeCompare(b.name)
        );
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const skillPath = join(skillsDir, entry.name);
            const skillMdPath = join(skillPath, "SKILL.md");
            const readmePath = join(skillPath, "README.md");
            const docPath = existsSync(skillMdPath)
                ? skillMdPath
                : existsSync(readmePath)
                  ? readmePath
                  : null;
            if (!docPath) continue;

            const content = readFileSync(docPath, "utf-8");
            registerAsset(
                parseAssetMetadata(
                    entry.name,
                    "skill",
                    skillPath,
                    true,
                    content
                )
            );
        }
    }

    return assets;
}

/**
 * Ensures the local git clone of awesome-copilot is present and up to date.
 */
export async function ensureAwesomeCopilotRepo(
    repoDir: string = awesomeCopilotRoot(),
    remoteUrl: string = AWESOME_COPILOT_REPO_URL
): Promise<void> {
    const gitDir = join(repoDir, ".git");
    if (existsSync(gitDir)) {
        const git = simpleGit(repoDir);
        await git.pull(["--ff-only"]);
    } else {
        mkdirSync(repoDir, { recursive: true });
        const git = simpleGit();
        await git.clone(remoteUrl, repoDir, ["--depth", "1"]);
    }
}

/**
 * Loads the cached catalogue from ~/.agentsmith/catalogue.json.
 */
export function loadCatalogue(): CatalogueEntry[] {
    const file = cataloguePath();
    if (!existsSync(file)) return [];
    return JSON.parse(readFileSync(file, "utf-8")) as CatalogueEntry[];
}

/**
 * Loads the cached manifest from ~/.agentsmith/manifest.json.
 */
export function loadManifest(): ManifestEntry[] {
    const file = manifestPath();
    if (!existsSync(file)) return [];
    return JSON.parse(readFileSync(file, "utf-8")) as ManifestEntry[];
}

/**
 * Validates structural integrity and guards against accidental mass removals.
 */
export function validateSyncSafety(
    assets: Asset[],
    previousManifest: ManifestEntry[],
    force = false
): void {
    if (force) return;

    if (assets.length === 0) {
        throw new Error(
            "Safety check failed: structural change detected — no valid assets found in awesome-copilot source. Pass --force to override."
        );
    }

    if (previousManifest.length > 0) {
        const currentIds = new Set(assets.map((a) => a.id));
        const removedCount = previousManifest.filter(
            (m) => !currentIds.has(m.id)
        ).length;
        const removalRatio = removedCount / previousManifest.length;

        if (removalRatio > MASS_REMOVAL_THRESHOLD) {
            throw new Error(
                `Safety check failed: mass removal detected (${removedCount}/${previousManifest.length} assets removed). Pass --force to override.`
            );
        }
    }
}

/**
 * Syncs the awesome-copilot repository into the local cache and updates catalogue.json and manifest.json.
 */
export async function syncAwesomeCopilot(
    options: SyncOptions = {}
): Promise<SyncResult> {
    const repoDir = options.repoDir ?? awesomeCopilotRoot();
    const dryRun = Boolean(options.dryRun);
    const force = Boolean(options.force);

    const legacyCacheDetected =
        !existsSync(cataloguePath()) && existsSync(legacyCacheRoot());

    if (!options.skipGit) {
        await ensureAwesomeCopilotRepo(repoDir, options.remoteUrl);
    }

    const previousManifest = loadManifest();
    const assets = scanAwesomeCopilotRepo(repoDir);

    validateSyncSafety(assets, previousManifest, force);

    const prevById = new Map(previousManifest.map((m) => [m.id, m]));
    const currentById = new Map(assets.map((a) => [a.id, a]));

    const added: string[] = [];
    const updated: string[] = [];
    const unchanged: string[] = [];
    const removed: string[] = [];

    for (const asset of assets) {
        const prev = prevById.get(asset.id);
        if (!prev) {
            added.push(asset.id);
        } else if (prev.hash !== asset.hash) {
            updated.push(asset.id);
        } else {
            unchanged.push(asset.id);
        }
    }

    for (const prev of previousManifest) {
        if (!currentById.has(prev.id)) {
            removed.push(prev.id);
        }
    }

    if (!dryRun) {
        mkdirSync(cacheRoot(), { recursive: true });
        const now = new Date().toISOString();

        const catalogue: CatalogueEntry[] = assets.map((asset) => ({
            id: asset.id,
            type: asset.type,
            title: asset.title,
            description: asset.description,
            source: asset.source,
            requiresSetup: asset.requiresSetup,
            tags: asset.tags,
        }));

        const manifest: ManifestEntry[] = assets.map((asset) => ({
            id: asset.id,
            type: asset.type,
            localPath: asset.localPath,
            hash: asset.hash,
            syncedAt: now,
        }));

        writeFileSync(
            cataloguePath(),
            JSON.stringify(catalogue, null, 2) + "\n",
            "utf-8"
        );
        writeFileSync(
            manifestPath(),
            JSON.stringify(manifest, null, 2) + "\n",
            "utf-8"
        );
    }

    return {
        assets,
        added,
        updated,
        removed,
        unchanged,
        dryRun,
        legacyCacheDetected,
    };
}
