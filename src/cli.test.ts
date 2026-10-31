import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync, spawn } from "node:child_process";
import {
    mkdtempSync,
    mkdirSync,
    writeFileSync,
    rmSync,
    existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { syncAwesomeCopilot } from "./sources/awesome-copilot.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, "..");
const cliJs = join(root, "dist", "cli.js");

describe("agentsmith CLI", () => {
    let tempHome: string;
    let fakeRepoDir: string;
    let workDir: string;

    beforeEach(async () => {
        tempHome = mkdtempSync(join(tmpdir(), "agentsmith-cli-home-"));
        fakeRepoDir = mkdtempSync(join(tmpdir(), "agentsmith-cli-repo-"));
        workDir = mkdtempSync(join(tmpdir(), "agentsmith-cli-work-"));

        mkdirSync(join(fakeRepoDir, "instructions"), { recursive: true });
        writeFileSync(
            join(fakeRepoDir, "instructions", "clean-code.instructions.md"),
            [
                "---",
                "description: 'Clean code rules'",
                'applyTo: "**/*.ts"',
                'tags: ["clean", "typescript"]',
                "---",
                "# Clean Code",
                "Keep functions small.",
            ].join("\n"),
            "utf-8"
        );

        const prevHome = process.env.AGENTSMITH_HOME;
        process.env.AGENTSMITH_HOME = tempHome;
        try {
            await syncAwesomeCopilot({ repoDir: fakeRepoDir, skipGit: true });
        } finally {
            if (prevHome === undefined) delete process.env.AGENTSMITH_HOME;
            else process.env.AGENTSMITH_HOME = prevHome;
        }
    });

    afterEach(() => {
        rmSync(tempHome, { recursive: true, force: true });
        rmSync(fakeRepoDir, { recursive: true, force: true });
        rmSync(workDir, { recursive: true, force: true });
    });

    it("exits 0 on --version", () => {
        const result = execSync(`node "${cliJs}" --version`, {
            cwd: root,
            encoding: "utf-8",
        });
        expect(result.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("exits 0 on --help", () => {
        const result = execSync(`node "${cliJs}" --help`, {
            cwd: root,
            encoding: "utf-8",
        });
        expect(result).toContain("agentsmith");
        expect(result).toContain("sync");
        expect(result).toContain("install");
        expect(result).toContain("update");
        expect(result).toContain("remove");
        expect(result).toContain("list");
    });

    it("runs install, list, update, and remove end-to-end via CLI", () => {
        const env = { ...process.env, AGENTSMITH_HOME: tempHome };

        const installOut = execSync(
            `node "${cliJs}" install clean-code --target kiro --scope repo`,
            { cwd: workDir, env, encoding: "utf-8" }
        );
        expect(installOut).toContain("installed 'clean-code' -> kiro:repo");
        expect(
            existsSync(join(workDir, ".kiro", "steering", "clean-code.md"))
        ).toBe(true);

        const listOut = execSync(`node "${cliJs}" list --target kiro`, {
            cwd: workDir,
            env,
            encoding: "utf-8",
        });
        expect(listOut).toContain("[*] clean-code (steering) -> kiro:repo");

        const updateOut = execSync(`node "${cliJs}" update --target kiro`, {
            cwd: workDir,
            env,
            encoding: "utf-8",
        });
        expect(updateOut).toContain("Already up to date");

        const removeOut = execSync(
            `node "${cliJs}" remove clean-code --target kiro --scope repo`,
            { cwd: workDir, env, encoding: "utf-8" }
        );
        expect(removeOut).toContain("removed 'clean-code' from kiro:repo");
        expect(
            existsSync(join(workDir, ".kiro", "steering", "clean-code.md"))
        ).toBe(false);
    });

    it("prompts to select a target environment when running install without --target in an empty workspace", async () => {
        const env = { ...process.env, AGENTSMITH_HOME: tempHome };

        const out = await new Promise<string>((resolve, reject) => {
            const child = spawn(process.execPath, [cliJs, "install"], {
                cwd: workDir,
                env,
                stdio: ["pipe", "pipe", "pipe"],
            });

            let stdout = "";
            let stderr = "";
            let sentTargetSelection = false;
            let sentAssetSelection = false;

            child.stdout.on("data", (chunk: Buffer) => {
                stdout += chunk.toString("utf-8");
                if (
                    !sentTargetSelection &&
                    stdout.includes("Select target environment:")
                ) {
                    sentTargetSelection = true;
                    child.stdin.write("\n");
                } else if (
                    sentTargetSelection &&
                    !sentAssetSelection &&
                    stdout.includes("Select assets to install for vscode")
                ) {
                    sentAssetSelection = true;
                    child.stdin.write("\n");
                    child.stdin.end();
                }
            });

            child.stderr.on("data", (chunk: Buffer) => {
                stderr += chunk.toString("utf-8");
            });

            child.on("error", reject);
            child.on("close", (code) => {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(
                        new Error(
                            `Process exited with code ${String(code)}: ${stderr || stdout}`
                        )
                    );
                }
            });
        });

        expect(out).toContain("Select target environment:");
        expect(out).toContain("Select assets to install for vscode");
    });

    it("installs recommended assets with --recommended flag", () => {
        writeFileSync(join(workDir, "tsconfig.json"), "{}", "utf-8");
        const result = execSync(
            `node "${cliJs}" install --recommended --target kiro --scope repo`,
            {
                cwd: workDir,
                env: { ...process.env, AGENTSMITH_HOME: tempHome },
                encoding: "utf-8",
            }
        );

        expect(result).toContain("installed 'clean-code' -> kiro:repo");
        expect(
            existsSync(join(workDir, ".kiro", "steering", "clean-code.md"))
        ).toBe(true);
    });

    it("installs filtered assets with --search and --type flags", () => {
        const searchResult = execSync(
            `node "${cliJs}" install clean-code --search clean --target kiro --scope repo`,
            {
                cwd: workDir,
                env: { ...process.env, AGENTSMITH_HOME: tempHome },
                encoding: "utf-8",
            }
        );
        expect(searchResult).toContain("clean-code");

        writeFileSync(join(workDir, "tsconfig.json"), "{}", "utf-8");
        const typeResult = execSync(
            `node "${cliJs}" install --type steering --target kiro --scope repo --recommended`,
            {
                cwd: workDir,
                env: { ...process.env, AGENTSMITH_HOME: tempHome },
                encoding: "utf-8",
            }
        );
        expect(typeResult).toContain("clean-code");
    });

    it("fails immediately without prompting for a target when the local catalogue is empty", () => {
        const emptyHome = mkdtempSync(join(tmpdir(), "agentsmith-empty-home-"));
        try {
            let errOutput = "";
            try {
                execSync(`node "${cliJs}" install`, {
                    cwd: workDir,
                    env: { ...process.env, AGENTSMITH_HOME: emptyHome },
                    encoding: "utf-8",
                    stdio: ["pipe", "pipe", "pipe"],
                });
            } catch (err) {
                const execErr = err as { stderr?: string; stdout?: string };
                errOutput = `${execErr.stdout ?? ""}${execErr.stderr ?? ""}`;
            }
            expect(errOutput).toContain(
                "Error: Local catalogue is empty. Run 'agentsmith sync' first."
            );
            expect(errOutput).not.toContain("Select target environment:");
        } finally {
            rmSync(emptyHome, { recursive: true, force: true });
        }
    });
});
