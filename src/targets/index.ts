/**
 * Target adapter registry for VS Code, Kiro, and Antigravity.
 */

import type { AssetType, Scope, Target } from "../types.js";
import {
    type AdaptationResult,
    adaptForVscode,
    resolveVscodeBaseDir,
    resolveVscodeTargetPath,
} from "./vscode.js";
import {
    adaptForKiro,
    resolveKiroBaseDir,
    resolveKiroTargetPath,
} from "./kiro.js";
import {
    adaptForAntigravity,
    resolveAntigravityBaseDir,
    resolveAntigravityTargetPath,
} from "./antigravity.js";

export type { AdaptationResult };

export const ALL_TARGETS: readonly Target[] = [
    "vscode",
    "kiro",
    "antigravity",
] as const;

export interface TargetAdapter {
    target: Target;
    resolveBaseDir(scope: Scope, cwd?: string, home?: string): string;
    resolveTargetPath(
        assetId: string,
        type: AssetType,
        scope: Scope,
        cwd?: string,
        home?: string
    ): string | null;
    adaptContent(content: string, type: AssetType): AdaptationResult;
}

const adapters: Record<Target, TargetAdapter> = {
    vscode: {
        target: "vscode",
        resolveBaseDir: resolveVscodeBaseDir,
        resolveTargetPath: resolveVscodeTargetPath,
        adaptContent: adaptForVscode,
    },
    kiro: {
        target: "kiro",
        resolveBaseDir: resolveKiroBaseDir,
        resolveTargetPath: resolveKiroTargetPath,
        adaptContent: adaptForKiro,
    },
    antigravity: {
        target: "antigravity",
        resolveBaseDir: resolveAntigravityBaseDir,
        resolveTargetPath: resolveAntigravityTargetPath,
        adaptContent: adaptForAntigravity,
    },
};

export function isValidTarget(value: string): value is Target {
    return value === "vscode" || value === "kiro" || value === "antigravity";
}

export function isValidScope(value: string): value is Scope {
    return value === "repo" || value === "user";
}

export interface TargetTerminology {
    singular: Record<AssetType, string>;
    plural: Record<AssetType, string>;
}

export const TARGET_TERMINOLOGY: Record<Target, TargetTerminology> = {
    vscode: {
        singular: {
            instruction: "instruction",
            rule: "instruction",
            agent: "agent",
            skill: "skill",
            plugin: "plugin",
            workflow: "workflow",
        },
        plural: {
            instruction: "instructions",
            rule: "instructions",
            agent: "agents",
            skill: "skills",
            plugin: "plugins",
            workflow: "workflows",
        },
    },
    kiro: {
        singular: {
            instruction: "steering",
            rule: "steering",
            agent: "agent",
            skill: "skill",
            plugin: "plugin",
            workflow: "workflow",
        },
        plural: {
            instruction: "steering",
            rule: "steering",
            agent: "agents",
            skill: "skills",
            plugin: "plugins",
            workflow: "workflows",
        },
    },
    antigravity: {
        singular: {
            instruction: "rule",
            rule: "rule",
            agent: "agent",
            skill: "skill",
            plugin: "plugin",
            workflow: "workflow",
        },
        plural: {
            instruction: "rules",
            rule: "rules",
            agent: "agents",
            skill: "skills",
            plugin: "plugins",
            workflow: "workflows",
        },
    },
};

export function getTargetTypeLabel(type: AssetType, target: Target): string {
    return TARGET_TERMINOLOGY[target]?.singular[type] ?? type;
}

export function getTargetTypePlural(type: AssetType, target: Target): string {
    return TARGET_TERMINOLOGY[target]?.plural[type] ?? `${type}s`;
}

export function normaliseTargetAssetType(
    rawType: string,
    _target?: Target
): AssetType | undefined {
    const lower = rawType.toLowerCase().trim();
    if (lower === "instruction" || lower === "instructions")
        return "instruction";
    if (lower === "agent" || lower === "agents") return "agent";
    if (lower === "skill" || lower === "skills") return "skill";
    if (lower === "steering") return "instruction";
    if (lower === "rule" || lower === "rules") return "instruction";
    if (lower === "plugin" || lower === "plugins") return "plugin";
    if (lower === "workflow" || lower === "workflows") return "workflow";
    return undefined;
}

export function getTargetAdapter(target: Target): TargetAdapter {
    const adapter = adapters[target];
    if (!adapter) {
        throw new Error(`Unknown target environment: '${String(target)}'`);
    }
    return adapter;
}
