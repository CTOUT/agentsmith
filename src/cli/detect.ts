/**
 * Auto-detect target environments from the current working directory.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { ALL_TARGETS } from "../targets/index.js";
import type { Target } from "../types.js";
import { promptSelectTarget } from "./picker.js";

/**
 * Detects active target environments in `cwd` by checking for `.github`, `.kiro`, and `.agents`/`.gemini`.
 */
export function detectTargets(
    cwd: string = process.cwd(),
    fallbackToDefault = true
): Target[] {
    const detected: Target[] = [];

    if (existsSync(join(cwd, ".github"))) {
        detected.push("vscode");
    }
    if (existsSync(join(cwd, ".kiro"))) {
        detected.push("kiro");
    }
    if (existsSync(join(cwd, ".agents")) || existsSync(join(cwd, ".gemini"))) {
        detected.push("antigravity");
    }

    if (detected.length === 0 && fallbackToDefault) {
        return ["vscode"];
    }

    return detected;
}

/**
 * Resolves the target environment for a command:
 * - Returns `explicitTarget` immediately if supplied.
 * - Auto-selects the single detected target if exactly one marker directory exists in `cwd`.
 * - Prompts the user with detected targets (when multiple exist) or all targets (when none exist in `cwd`).
 */
export async function resolveTarget(
    explicitTarget?: Target,
    cwd: string = process.cwd(),
    promptFn: (targets: Target[]) => Promise<Target> = promptSelectTarget
): Promise<Target> {
    if (explicitTarget) {
        return explicitTarget;
    }

    const detected = detectTargets(cwd, false);
    if (detected.length === 1) {
        return detected[0];
    }

    const choices = detected.length > 1 ? detected : [...ALL_TARGETS];
    return promptFn(choices);
}
