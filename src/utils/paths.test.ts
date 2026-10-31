import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    mkdtempSync,
    mkdirSync,
    writeFileSync,
    symlinkSync,
    rmSync,
} from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import {
    cacheRoot,
    legacyCacheRoot,
    awesomeCopilotRoot,
    cataloguePath,
    manifestPath,
    subscriptionsPath,
    assertPathWithin,
} from "./paths.js";

describe("paths utilities", () => {
    let tempDir: string;
    const originalEnv = process.env.AGENTSMITH_HOME;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), "agentsmith-paths-"));
    });

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.AGENTSMITH_HOME;
        } else {
            process.env.AGENTSMITH_HOME = originalEnv;
        }
        rmSync(tempDir, { recursive: true, force: true });
    });

    it("resolves default and overridden cache paths", () => {
        delete process.env.AGENTSMITH_HOME;
        expect(cacheRoot()).toBe(join(homedir(), ".agentsmith"));
        expect(legacyCacheRoot()).toBe(join(homedir(), ".awesome-copilot"));

        process.env.AGENTSMITH_HOME = tempDir;
        expect(cacheRoot()).toBe(tempDir);
        expect(awesomeCopilotRoot()).toBe(
            join(tempDir, "sources", "awesome-copilot")
        );
        expect(cataloguePath()).toBe(join(tempDir, "catalogue.json"));
        expect(manifestPath()).toBe(join(tempDir, "manifest.json"));
        expect(subscriptionsPath()).toBe(join(tempDir, "subscriptions.json"));
    });

    describe("assertPathWithin", () => {
        it("allows nested child paths inside baseDir", () => {
            const child = join(tempDir, "nested", "file.md");
            expect(() => assertPathWithin(child, tempDir)).not.toThrow();
        });

        it("rejects equal path unless allowEqual is true", () => {
            expect(() => assertPathWithin(tempDir, tempDir)).toThrow(
                /traverses outside/
            );
            expect(() =>
                assertPathWithin(tempDir, tempDir, true)
            ).not.toThrow();
        });

        it("rejects parent traversal (../)", () => {
            const escaped = join(tempDir, "..", "outside.md");
            expect(() => assertPathWithin(escaped, tempDir)).toThrow(
                /traverses outside/
            );
        });

        it("rejects sibling directory with shared prefix", () => {
            const sibling = `${tempDir}-sibling`;
            expect(() => assertPathWithin(sibling, tempDir)).toThrow(
                /traverses outside/
            );
        });

        it("rejects symbolic link traversal", () => {
            const outsideDir = mkdtempSync(
                join(tmpdir(), "agentsmith-outside-")
            );
            const outsideFile = join(outsideDir, "secret.txt");
            writeFileSync(outsideFile, "secret", "utf-8");

            const linkPath = join(tempDir, "linked");
            let symlinkCreated = false;
            try {
                symlinkSync(outsideDir, linkPath, "junction");
                symlinkCreated = true;
            } catch {
                // Ignore if OS privilege forbids symlink creation
            }

            try {
                if (symlinkCreated) {
                    expect(() =>
                        assertPathWithin(join(linkPath, "secret.txt"), tempDir)
                    ).toThrow(/symbolic link/);
                }
            } finally {
                rmSync(outsideDir, { recursive: true, force: true });
            }
        });

        it("allows existing regular directories and files", () => {
            const subDir = join(tempDir, "existing");
            mkdirSync(subDir, { recursive: true });
            const file = join(subDir, "item.md");
            writeFileSync(file, "hello", "utf-8");

            expect(() => assertPathWithin(file, tempDir)).not.toThrow();
        });
    });
});
