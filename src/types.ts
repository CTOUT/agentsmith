/**
 * Core shared types for agentsmith.
 */

/** Canonical asset types across all sources and targets. */
export type AssetType =
    "agent" | "instruction" | "skill" | "plugin" | "rule" | "workflow";

/** Supported target environments. */
export type Target = "vscode" | "kiro" | "antigravity";

/** Installation scope. */
export type Scope = "repo" | "user";

/** Portability outcome for a target adapter. */
export type CompatibilityOutcome = "native" | "adapted" | "unsupported";

/**
 * A canonical asset as returned by a source adapter.
 * Mirrors the canonical-asset schema from vscode-copilot-sync.
 */
export interface Asset {
    id: string;
    type: AssetType;
    title: string;
    description: string;
    source: string;
    /** Path to the asset on the local filesystem (within the cache). */
    localPath: string;
    /** Whether this is a directory (skills) or a single file. */
    isDirectory: boolean;
    /** SHA-256 hash of the asset content (file hash or directory tree hash). */
    hash: string;
    requiresSetup: boolean;
    tags: string[];
}

/**
 * Catalogue entry as stored in ~/.agentsmith/cache/catalogue.json.
 * Lightweight metadata for display in the picker — no content loaded.
 */
export interface CatalogueEntry {
    id: string;
    type: AssetType;
    title: string;
    description: string;
    source: string;
    requiresSetup: boolean;
    tags: string[];
}

/**
 * Manifest entry as stored in ~/.agentsmith/cache/manifest.json.
 * Tracks sync state across runs.
 */
export interface ManifestEntry {
    id: string;
    type: AssetType;
    localPath: string;
    hash: string;
    syncedAt: string; // ISO 8601
}

/**
 * A subscription record — one installed asset at a specific target and scope.
 * Stored in subscriptions.json.
 */
export interface Subscription {
    id: string;
    type: AssetType;
    target: Target;
    scope: Scope;
    /** Absolute path to the installed file or directory. */
    installedPath: string;
    /** Hash of the content at install time — used to detect local edits. */
    installedHash: string;
    /** Hash of the upstream source at install time — used to detect updates. */
    sourceHash: string;
    installedAt: string; // ISO 8601
    updatedAt: string; // ISO 8601
}

/**
 * Status of an installed asset — computed at runtime by comparing hashes.
 */
export interface AssetStatus {
    subscription: Subscription;
    /** Whether the installed file/directory still exists. */
    exists: boolean;
    /** Whether the installed content differs from when it was installed (local edit). */
    locallyModified: boolean;
    /** Whether the upstream source has a newer version available. */
    updateAvailable: boolean;
    /** The current upstream hash, if an update is available. */
    upstreamHash?: string;
}

/**
 * Result of an install, update, or remove operation.
 */
export interface OperationResult {
    id: string;
    target: Target;
    scope: Scope;
    success: boolean;
    action: "installed" | "updated" | "removed" | "skipped" | "failed";
    /** Human-readable reason for skipped or failed actions. */
    reason?: string;
    /** Whether frontmatter was adapted for the target. */
    adapted?: boolean;
    /** Fields that were changed or dropped during adaptation. */
    adaptations?: string[];
}
