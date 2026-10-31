import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    mkdtempSync,
    mkdirSync,
    writeFileSync,
    rmSync,
    existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { simpleGit } from "simple-git";
import {
    scanAwesomeCopilotRepo,
    syncAwesomeCopilot,
    loadCatalogue,
    loadManifest,
} from "./awesome-copilot.js";
import { cataloguePath, manifestPath } from "../utils/paths.js";

describe("awesome-copilot source adapter", () => {
    let tempHome: string;
    let fakeRepoDir: string;
    const origHome = process.env.AGENTSMITH_HOME;
    const origLegacy = process.env.AWESOME_COPILOT_HOME;

    beforeEach(() => {
        tempHome = mkdtempSync(join(tmpdir(), "agentsmith-sync-home-"));
        fakeRepoDir = mkdtempSync(join(tmpdir(), "agentsmith-fake-repo-"));
        process.env.AGENTSMITH_HOME = tempHome;
        process.env.AWESOME_COPILOT_HOME = join(tempHome, "missing-legacy");
    });

    afterEach(() => {
        if (origHome === undefined) delete process.env.AGENTSMITH_HOME;
        else process.env.AGENTSMITH_HOME = origHome;

        if (origLegacy === undefined) delete process.env.AWESOME_COPILOT_HOME;
        else process.env.AWESOME_COPILOT_HOME = origLegacy;

        rmSync(tempHome, { recursive: true, force: true });
        rmSync(fakeRepoDir, { recursive: true, force: true });
    });

    function populateSampleRepo() {
        mkdirSync(join(fakeRepoDir, "instructions"), { recursive: true });
        mkdirSync(join(fakeRepoDir, "agents"), { recursive: true });
        mkdirSync(join(fakeRepoDir, "skills", "webapp-testing"), {
            recursive: true,
        });

        writeFileSync(
            join(fakeRepoDir, "instructions", "typescript.instructions.md"),
            [
                "---",
                "description: 'TypeScript coding rules'",
                'applyTo: "**/*.ts"',
                "tags: ['typescript', 'nodejs']",
                "---",
                "# TypeScript Guidelines",
                "Use strict types.",
            ].join("\n"),
            "utf-8"
        );

        writeFileSync(
            join(fakeRepoDir, "agents", "reviewer.agent.md"),
            [
                "---",
                "title: 'Code Reviewer'",
                "description: 'Reviews pull requests'",
                "requiresSetup: true",
                "---",
                "# Reviewer Agent",
                "Check security and tests.",
            ].join("\n"),
            "utf-8"
        );

        writeFileSync(
            join(fakeRepoDir, "skills", "webapp-testing", "SKILL.md"),
            [
                "---",
                "name: 'Webapp Testing'",
                "description: 'End-to-end testing skill'",
                "---",
                "# Webapp Testing",
                "Run playwright suites.",
            ].join("\n"),
            "utf-8"
        );
    }

    it("scans instructions, agents, and skills with metadata and hashes", () => {
        populateSampleRepo();
        writeFileSync(
            join(fakeRepoDir, "instructions", "README.md"),
            "# Instructions Directory\nNot an asset.",
            "utf-8"
        );
        writeFileSync(
            join(fakeRepoDir, "agents", "README.md"),
            "# Agents Directory\nNot an asset.",
            "utf-8"
        );

        const assets = scanAwesomeCopilotRepo(fakeRepoDir);
        expect(assets).toHaveLength(3);

        const ts = assets.find((a) => a.id === "typescript");
        expect(ts).toBeDefined();
        expect(ts?.type).toBe("instruction");
        expect(ts?.title).toBe("TypeScript Guidelines");
        expect(ts?.description).toBe("TypeScript coding rules");
        expect(ts?.tags).toEqual(["typescript", "nodejs"]);
        expect(ts?.isDirectory).toBe(false);

        const reviewer = assets.find((a) => a.id === "reviewer");
        expect(reviewer).toBeDefined();
        expect(reviewer?.type).toBe("agent");
        expect(reviewer?.requiresSetup).toBe(true);

        const skill = assets.find((a) => a.id === "webapp-testing");
        expect(skill).toBeDefined();
        expect(skill?.type).toBe("skill");
        expect(skill?.isDirectory).toBe(true);
    });

    it("disambiguates multi-way ID collisions across folders without duplicates", () => {
        mkdirSync(join(fakeRepoDir, "instructions"), { recursive: true });
        mkdirSync(join(fakeRepoDir, "agents"), { recursive: true });
        mkdirSync(join(fakeRepoDir, "chatmodes"), { recursive: true });

        writeFileSync(
            join(fakeRepoDir, "instructions", "sec.instructions.md"),
            "# Sec Instruction\n",
            "utf-8"
        );
        writeFileSync(
            join(fakeRepoDir, "agents", "sec.agent.md"),
            "# Sec Agent\n",
            "utf-8"
        );
        writeFileSync(
            join(fakeRepoDir, "chatmodes", "sec.chatmode.md"),
            "# Sec Chatmode\n",
            "utf-8"
        );

        const assets = scanAwesomeCopilotRepo(fakeRepoDir);
        const ids = assets.map((a) => a.id);
        expect(ids).toEqual(["sec", "agent-sec", "agent-sec-2"]);
    });

    it("clones and pulls a git repository via ensureAwesomeCopilotRepo during sync", async () => {
        populateSampleRepo();
        const upstreamGit = simpleGit(fakeRepoDir);
        await upstreamGit.init();
        await upstreamGit.addConfig("user.email", "test@example.com");
        await upstreamGit.addConfig("user.name", "Test User");
        await upstreamGit.add(".");
        await upstreamGit.commit("Initial commit");

        const cloneDir = join(tempHome, "cloned-repo");
        const remoteUrl = pathToFileURL(fakeRepoDir).href;

        const firstSync = await syncAwesomeCopilot({
            repoDir: cloneDir,
            remoteUrl,
        });
        expect(firstSync.added).toHaveLength(3);
        expect(existsSync(join(cloneDir, ".git"))).toBe(true);

        // Commit an update in the upstream repository and pull via second sync
        writeFileSync(
            join(fakeRepoDir, "instructions", "typescript.instructions.md"),
            "# TypeScript Guidelines v2\nUpdated via git pull.",
            "utf-8"
        );
        await upstreamGit.add(".");
        await upstreamGit.commit("Update typescript instruction");

        const secondSync = await syncAwesomeCopilot({
            repoDir: cloneDir,
            remoteUrl,
        });
        expect(secondSync.updated).toEqual(["typescript"]);
    });

    it("writes catalogue.json and manifest.json on sync and skips write on dryRun", async () => {
        populateSampleRepo();

        const dryRes = await syncAwesomeCopilot({
            repoDir: fakeRepoDir,
            skipGit: true,
            dryRun: true,
        });
        expect(dryRes.added).toHaveLength(3);
        expect(existsSync(cataloguePath())).toBe(false);
        expect(existsSync(manifestPath())).toBe(false);

        const syncRes = await syncAwesomeCopilot({
            repoDir: fakeRepoDir,
            skipGit: true,
        });
        expect(syncRes.added).toHaveLength(3);
        expect(loadCatalogue()).toHaveLength(3);
        expect(loadManifest()).toHaveLength(3);

        // Second sync with one modified file
        writeFileSync(
            join(fakeRepoDir, "instructions", "typescript.instructions.md"),
            "# Updated TypeScript Guidelines\nNew body.",
            "utf-8"
        );
        const secondRes = await syncAwesomeCopilot({
            repoDir: fakeRepoDir,
            skipGit: true,
        });
        expect(secondRes.updated).toEqual(["typescript"]);
        expect(secondRes.unchanged).toHaveLength(2);
    });

    it("aborts on structural change (0 assets) unless --force is passed", async () => {
        await expect(
            syncAwesomeCopilot({
                repoDir: fakeRepoDir,
                skipGit: true,
            })
        ).rejects.toThrow(/structural change detected/);

        const forced = await syncAwesomeCopilot({
            repoDir: fakeRepoDir,
            skipGit: true,
            force: true,
        });
        expect(forced.assets).toHaveLength(0);
    });

    it("aborts on mass removal (>50% removed) unless --force is passed", async () => {
        populateSampleRepo();
        await syncAwesomeCopilot({
            repoDir: fakeRepoDir,
            skipGit: true,
        });

        // Remove 2 out of 3 assets (66.7% removal)
        rmSync(join(fakeRepoDir, "agents"), { recursive: true, force: true });
        rmSync(join(fakeRepoDir, "skills"), { recursive: true, force: true });

        await expect(
            syncAwesomeCopilot({
                repoDir: fakeRepoDir,
                skipGit: true,
            })
        ).rejects.toThrow(/mass removal detected/);

        const forced = await syncAwesomeCopilot({
            repoDir: fakeRepoDir,
            skipGit: true,
            force: true,
        });
        expect(forced.removed).toHaveLength(2);
        expect(forced.assets).toHaveLength(1);
    });
});
