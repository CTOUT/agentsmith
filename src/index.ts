/**
 * agentsmith — public API surface
 *
 * The CLI entry point is src/cli.ts.
 * This file exports the programmatic API for use as a library.
 */

export const VERSION = "0.1.0";

export type {
    Asset,
    AssetStatus,
    AssetType,
    CatalogueEntry,
    CompatibilityOutcome,
    ManifestEntry,
    OperationResult,
    Scope,
    Subscription,
    Target,
} from "./types.js";

export {
    assertPathWithin,
    awesomeCopilotRoot,
    cacheRoot,
    cataloguePath,
    legacyCacheRoot,
    manifestPath,
    subscriptionsPath,
} from "./utils/paths.js";

export {
    type ParsedFrontmatter,
    parseFrontmatter,
    serialiseFrontmatter,
} from "./utils/frontmatter.js";

export {
    hashAssetPath,
    hashDirectory,
    hashFile,
    hashString,
} from "./lifecycle/hash.js";

export {
    AWESOME_COPILOT_REPO_URL,
    MASS_REMOVAL_THRESHOLD,
    SOURCE_NAME,
    type SyncOptions,
    type SyncResult,
    ensureAwesomeCopilotRepo,
    loadCatalogue,
    loadManifest,
    scanAwesomeCopilotRepo,
    syncAwesomeCopilot,
    validateSyncSafety,
} from "./sources/awesome-copilot.js";

export {
    type AdaptationResult,
    ALL_TARGETS,
    getTargetAdapter,
    getTargetTypeLabel,
    getTargetTypePlural,
    isValidScope,
    isValidTarget,
    normaliseTargetAssetType,
    type TargetAdapter,
    TARGET_TERMINOLOGY,
    type TargetTerminology,
} from "./targets/index.js";

export { type InstallOptions, installAsset } from "./lifecycle/install.js";
export {
    type UpdateOptions,
    updateSubscribedAssets,
} from "./lifecycle/update.js";
export { type RemoveOptions, removeAsset } from "./lifecycle/remove.js";
export {
    computeAssetStatus,
    findSubscription,
    listAssetStatuses,
    loadSubscriptions,
    removeSubscriptionRecord,
    saveSubscriptions,
    upsertSubscription,
} from "./lifecycle/subscriptions.js";

export {
    detectRepoStack,
    getRecommendedAssetIds,
    isRepoRecommended,
    isUserRecommended,
    USER_GENERAL_POSITIVE_SEGMENTS,
    USER_TECH_SPECIFIC_SEGMENTS,
    VENDOR_PREFIXES,
} from "./lifecycle/recommendations.js";

export { detectTargets, resolveTarget } from "./cli/detect.js";
export {
    centreAndPad,
    cleanDescription,
    filterCatalogueBySearch,
    formatAssetBadges,
    formatStatusLine,
    getTargetDisplayPath,
    type PromptInstallOptions,
    promptSelectAssetsToInstall,
    promptSelectAssetsToRemove,
    promptSelectTarget,
    truncateAndPad,
} from "./cli/picker.js";
