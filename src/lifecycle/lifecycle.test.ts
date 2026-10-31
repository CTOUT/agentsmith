import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    mkdtempSync,
    mkdirSync,
    writeFileSync,
    readFileSync,
    existsSync,
    rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncAwesomeCopilot } from "../sources/awesome-copilot.js";
import { installAsset } from "./install.js";
import { updateSubscribedAssets } from "./update.js";
import { removeAsset } from "./remove.js";
import { listAssetStatuses, loadSubscriptions } from "./subscriptions.js";
import { detectTargets, resolveTarget } from "../cli/detect.js";
import { formatAssetBadges, formatStatusLine } from "../cli/picker.js";
import type { Target } from "../types.js";

describe("lifecycle: install, update, remove, subscriptions, detect, badges", () => {
    let tempHome: string;
    let fakeRepoDir: string;
    let workDir: string;
    const origHome = process.env.AGENTSMITH_HOME;

    beforeEach(async () => {
        tempHome = mkdtempSync(join(tmpdir(), "agentsmith-life-home-"));
        fakeRepoDir = mkdtempSync(join(tmpdir(), "agentsmith-life-repo-"));
        workDir = mkdtempSync(join(tmpdir(), "agentsmith-life-cwd-"));
        process.env.AGENTSMITH_HOME = tempHome;

        mkdirSync(join(fakeRepoDir, "instructions"), { recursive: true });
        mkdirSync(join(fakeRepoDir, "skills", "pdf-helper"), {
            recursive: true,
        });

        writeFileSync(
            join(fakeRepoDir, "instructions", "ts-rules.instructions.md"),
            [
                "---",
                "description: 'TypeScript strict rules'",
                'applyTo: "**/*.ts"',
                "---",
                "# TS Rules",
                "Always enable strict mode.",
            ].join("\n"),
            "utf-8"
        );

        writeFileSync(
            join(fakeRepoDir, "skills", "pdf-helper", "SKILL.md"),
            [
                "---",
                "name: 'PDF Helper'",
                "description: 'Extracts PDF tables'",
                "---",
                "# PDF Helper",
                "Use pdfplumber.",
            ].join("\n"),
            "utf-8"
        );

        await syncAwesomeCopilot({
            repoDir: fakeRepoDir,
            skipGit: true,
        });
    });

    afterEach(() => {
        if (origHome === undefined) delete process.env.AGENTSMITH_HOME;
        else process.env.AGENTSMITH_HOME = origHome;

        rmSync(tempHome, { recursive: true, force: true });
        rmSync(fakeRepoDir, { recursive: true, force: true });
        rmSync(workDir, { recursive: true, force: true });
    });

    it("installs file and directory assets across targets and tracks subscriptions", () => {
        // Install instruction to Kiro (repo scope)
        const kiroRes = installAsset("ts-rules", {
            target: "kiro",
            scope: "repo",
            cwd: workDir,
            home: tempHome,
        });
        expect(kiroRes.success).toBe(true);
        expect(kiroRes.action).toBe("installed");
        expect(kiroRes.adapted).toBe(true);

        const installedKiroFile = join(
            workDir,
            ".kiro",
            "steering",
            "ts-rules.md"
        );
        expect(existsSync(installedKiroFile)).toBe(true);
        expect(readFileSync(installedKiroFile, "utf-8")).toContain(
            "inclusion: fileMatch"
        );

        // Install skill directory to Antigravity (user scope)
        const agRes = installAsset("pdf-helper", {
            target: "antigravity",
            scope: "user",
            cwd: workDir,
            home: tempHome,
        });
        expect(agRes.success).toBe(true);
        expect(agRes.action).toBe("installed");

        const installedSkillMd = join(
            tempHome,
            ".gemini",
            "config",
            "plugins",
            "pdf-helper",
            "skills",
            "pdf-helper",
            "SKILL.md"
        );
        expect(existsSync(installedSkillMd)).toBe(true);

        const subs = loadSubscriptions();
        expect(subs).toHaveLength(2);
    });

    it("detects local edits and protects them during install and update unless --force is passed", async () => {
        installAsset("ts-rules", {
            target: "vscode",
            scope: "repo",
            cwd: workDir,
            home: tempHome,
        });

        const installedFile = join(
            workDir,
            ".github",
            "instructions",
            "ts-rules.instructions.md"
        );
        writeFileSync(installedFile, "# Custom Local Edit\n", "utf-8");

        const statuses = listAssetStatuses({ target: "vscode", scope: "repo" });
        expect(statuses).toHaveLength(1);
        expect(statuses[0].locallyModified).toBe(true);

        // Modify upstream and re-sync
        writeFileSync(
            join(fakeRepoDir, "instructions", "ts-rules.instructions.md"),
            "# TS Rules v2\nUpdated upstream.",
            "utf-8"
        );
        await syncAwesomeCopilot({
            repoDir: fakeRepoDir,
            skipGit: true,
        });

        // Update without force should skip locally modified file
        const updateSkipped = updateSubscribedAssets({
            target: "vscode",
            scope: "repo",
            cwd: workDir,
            home: tempHome,
        });
        expect(updateSkipped[0].action).toBe("skipped");
        expect(updateSkipped[0].reason).toContain("Local modifications");
        expect(readFileSync(installedFile, "utf-8")).toBe(
            "# Custom Local Edit\n"
        );

        // Update with force overwrites local modification
        const updateForced = updateSubscribedAssets({
            target: "vscode",
            scope: "repo",
            force: true,
            cwd: workDir,
            home: tempHome,
        });
        expect(updateForced[0].action).toBe("updated");
        expect(updateForced[0].success).toBe(true);
        expect(readFileSync(installedFile, "utf-8")).toContain("TS Rules v2");
    });

    it("removes installed assets and cleans up subscription state", () => {
        installAsset("ts-rules", {
            target: "vscode",
            scope: "repo",
            cwd: workDir,
            home: tempHome,
        });

        const installedFile = join(
            workDir,
            ".github",
            "instructions",
            "ts-rules.instructions.md"
        );
        expect(existsSync(installedFile)).toBe(true);

        const rmRes = removeAsset("ts-rules", {
            target: "vscode",
            scope: "repo",
            cwd: workDir,
            home: tempHome,
        });
        expect(rmRes.success).toBe(true);
        expect(rmRes.action).toBe("removed");
        expect(existsSync(installedFile)).toBe(false);
        expect(existsSync(join(workDir, ".github"))).toBe(false);
        expect(detectTargets(workDir, false)).toEqual([]);
        expect(loadSubscriptions()).toHaveLength(0);
    });

    it("auto-detects targets from workspace folders, resolves target prompts, and formats status badges", async () => {
        expect(detectTargets(workDir, true)).toEqual(["vscode"]);
        expect(detectTargets(workDir, false)).toEqual([]);

        // Empty workspace must prompt with all targets rather than silently defaulting to vscode
        let promptedChoices: Target[] = [];
        const emptyTarget = await resolveTarget(
            undefined,
            workDir,
            async (choices) => {
                promptedChoices = choices;
                return "antigravity";
            }
        );
        expect(emptyTarget).toBe("antigravity");
        expect(promptedChoices).toEqual(["vscode", "kiro", "antigravity"]);

        // Single detected target auto-selects without prompting
        mkdirSync(join(workDir, ".kiro"), { recursive: true });
        let singlePromptCalled = false;
        const singleTarget = await resolveTarget(
            undefined,
            workDir,
            async () => {
                singlePromptCalled = true;
                return "vscode";
            }
        );
        expect(singleTarget).toBe("kiro");
        expect(singlePromptCalled).toBe(false);

        // Multiple detected targets prompt with only the detected targets
        mkdirSync(join(workDir, ".agents"), { recursive: true });
        expect(detectTargets(workDir)).toEqual(["kiro", "antigravity"]);
        let multiChoices: Target[] = [];
        const multiTarget = await resolveTarget(
            undefined,
            workDir,
            async (choices) => {
                multiChoices = choices;
                return choices[1];
            }
        );
        expect(multiTarget).toBe("antigravity");
        expect(multiChoices).toEqual(["kiro", "antigravity"]);

        // Explicit target bypasses detection and prompting
        let explicitPromptCalled = false;
        const explicitTarget = await resolveTarget(
            "vscode",
            workDir,
            async () => {
                explicitPromptCalled = true;
                return "kiro";
            }
        );
        expect(explicitTarget).toBe("vscode");
        expect(explicitPromptCalled).toBe(false);

        const badges = formatAssetBadges({
            recommended: true,
            installed: true,
            updateAvailable: true,
            locallyModified: true,
            requiresSetup: true,
        });
        expect(badges).toBe("★ [*] [↑] [~] [!]");

        installAsset("ts-rules", {
            target: "kiro",
            scope: "repo",
            cwd: workDir,
            home: tempHome,
        });
        const [st] = listAssetStatuses({ target: "kiro" });
        expect(formatStatusLine(st)).toContain(
            "[*] ts-rules (steering) -> kiro:repo"
        );
    });

    it("removes stale files inside skill directories when updating an installed skill", async () => {
        const legacyScript = join(
            fakeRepoDir,
            "skills",
            "pdf-helper",
            "legacy.sh"
        );
        writeFileSync(legacyScript, "echo old\n", "utf-8");
        await syncAwesomeCopilot({ repoDir: fakeRepoDir, skipGit: true });

        installAsset("pdf-helper", {
            target: "vscode",
            scope: "repo",
            cwd: workDir,
            home: tempHome,
        });

        const installedLegacy = join(
            workDir,
            ".github",
            "skills",
            "pdf-helper",
            "legacy.sh"
        );
        expect(existsSync(installedLegacy)).toBe(true);

        // Upstream removes legacy.sh and adds modern.sh
        rmSync(legacyScript, { force: true });
        writeFileSync(
            join(fakeRepoDir, "skills", "pdf-helper", "modern.sh"),
            "echo new\n",
            "utf-8"
        );
        await syncAwesomeCopilot({ repoDir: fakeRepoDir, skipGit: true });

        const updateRes = updateSubscribedAssets({
            target: "vscode",
            scope: "repo",
            cwd: workDir,
            home: tempHome,
        });
        expect(updateRes[0].action).toBe("updated");
        expect(existsSync(installedLegacy)).toBe(false);
        expect(
            existsSync(
                join(workDir, ".github", "skills", "pdf-helper", "modern.sh")
            )
        ).toBe(true);
    });

    it("isolates repo-scoped subscriptions across multiple repositories during install, update, and remove", async () => {
        const secondWorkDir = mkdtempSync(
            join(tmpdir(), "agentsmith-life-cwd2-")
        );
        try {
            const firstInstall = installAsset("ts-rules", {
                target: "kiro",
                scope: "repo",
                cwd: workDir,
                home: tempHome,
            });
            const secondInstall = installAsset("ts-rules", {
                target: "kiro",
                scope: "repo",
                cwd: secondWorkDir,
                home: tempHome,
            });

            expect(firstInstall.action).toBe("installed");
            expect(secondInstall.action).toBe("installed");
            expect(loadSubscriptions()).toHaveLength(2);

            // Modify upstream and re-sync
            writeFileSync(
                join(fakeRepoDir, "instructions", "ts-rules.instructions.md"),
                "# TS Rules Multi-Repo Update\nUpdated content.",
                "utf-8"
            );
            await syncAwesomeCopilot({ repoDir: fakeRepoDir, skipGit: true });

            // Update without passing cwd — both repositories must be updated in place
            const updateResults = updateSubscribedAssets({
                target: "kiro",
                scope: "repo",
                home: tempHome,
            });
            expect(updateResults).toHaveLength(2);
            expect(updateResults.every((r) => r.action === "updated")).toBe(
                true
            );
            expect(
                readFileSync(
                    join(workDir, ".kiro", "steering", "ts-rules.md"),
                    "utf-8"
                )
            ).toContain("TS Rules Multi-Repo Update");
            expect(
                readFileSync(
                    join(secondWorkDir, ".kiro", "steering", "ts-rules.md"),
                    "utf-8"
                )
            ).toContain("TS Rules Multi-Repo Update");

            // Removing from workDir leaves secondWorkDir subscription and file intact
            const rmFirst = removeAsset("ts-rules", {
                target: "kiro",
                scope: "repo",
                cwd: workDir,
                home: tempHome,
            });
            expect(rmFirst.success).toBe(true);
            expect(
                existsSync(join(workDir, ".kiro", "steering", "ts-rules.md"))
            ).toBe(false);
            expect(
                existsSync(
                    join(secondWorkDir, ".kiro", "steering", "ts-rules.md")
                )
            ).toBe(true);
            expect(loadSubscriptions()).toHaveLength(1);
        } finally {
            rmSync(secondWorkDir, { recursive: true, force: true });
        }
    });

    it("protects pre-existing untracked files during install unless --force is passed", () => {
        const untrackedPath = join(workDir, ".kiro", "steering", "ts-rules.md");
        mkdirSync(join(workDir, ".kiro", "steering"), { recursive: true });
        writeFileSync(untrackedPath, "# Hand-written Steering Rule\n", "utf-8");

        const skipped = installAsset("ts-rules", {
            target: "kiro",
            scope: "repo",
            cwd: workDir,
            home: tempHome,
        });
        expect(skipped.success).toBe(false);
        expect(skipped.action).toBe("skipped");
        expect(skipped.reason).toContain("Existing untracked file detected");
        expect(readFileSync(untrackedPath, "utf-8")).toBe(
            "# Hand-written Steering Rule\n"
        );

        const forced = installAsset("ts-rules", {
            target: "kiro",
            scope: "repo",
            force: true,
            cwd: workDir,
            home: tempHome,
        });
        expect(forced.success).toBe(true);
        expect(forced.action).toBe("installed");
        expect(readFileSync(untrackedPath, "utf-8")).toContain("TS Rules");
    });
});
