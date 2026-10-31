import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CatalogueEntry } from "../types.js";
import {
    detectRepoStack,
    getRecommendedAssetIds,
    isRepoRecommended,
    isUserRecommended,
} from "./recommendations.js";

describe("recommendations", () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), "agentsmith-rec-"));
    });

    afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true });
    });

    describe("detectRepoStack", () => {
        it("returns universal baseline tags for empty directory", () => {
            const tags = detectRepoStack(tempDir);
            expect(tags).toContain("security");
            expect(tags).toContain("owasp");
        });

        it("detects TypeScript and package.json framework dependencies", () => {
            writeFileSync(join(tempDir, "tsconfig.json"), "{}", "utf-8");
            writeFileSync(
                join(tempDir, "package.json"),
                JSON.stringify({
                    dependencies: {
                        next: "^14.0.0",
                        react: "^18.0.0",
                    },
                    devDependencies: {
                        "@types/react": "^18.0.0",
                    },
                }),
                "utf-8"
            );

            const tags = detectRepoStack(tempDir);
            expect(tags).toContain("typescript");
            expect(tags).toContain("javascript");
            expect(tags).toContain("react");
            expect(tags).toContain("nextjs");
        });

        it("detects Python and Docker signals", () => {
            writeFileSync(
                join(tempDir, "requirements.txt"),
                "flask\n",
                "utf-8"
            );
            writeFileSync(
                join(tempDir, "Dockerfile"),
                "FROM python:3.12\n",
                "utf-8"
            );

            const tags = detectRepoStack(tempDir);
            expect(tags).toContain("python");
            expect(tags).toContain("docker");
            expect(tags).toContain("container");
        });

        it("detects GitHub Actions workflow directory", () => {
            const wfDir = join(tempDir, ".github", "workflows");
            mkdirSync(wfDir, { recursive: true });
            writeFileSync(join(wfDir, "ci.yml"), "name: CI\n", "utf-8");

            const tags = detectRepoStack(tempDir);
            expect(tags).toContain("github-actions");
        });
    });

    describe("isUserRecommended", () => {
        it("recommends general-purpose engineering assets", () => {
            const cleanCode: CatalogueEntry = {
                id: "clean-code",
                type: "instruction",
                title: "Clean Code Practices",
                description: "Guidelines for writing clean, maintainable code",
                source: "awesome-copilot",
                requiresSetup: false,
                tags: ["clean-code", "quality"],
            };
            expect(isUserRecommended(cleanCode)).toBe(true);

            const securityReviewer: CatalogueEntry = {
                id: "se-security-reviewer",
                type: "agent",
                title: "Security Reviewer",
                description: "Performs security audits and code reviews",
                source: "awesome-copilot",
                requiresSetup: false,
                tags: ["security", "audit"],
            };
            expect(isUserRecommended(securityReviewer)).toBe(true);
        });

        it("rejects tech-specific assets at user level", () => {
            const pythonAsset: CatalogueEntry = {
                id: "python-standards",
                type: "instruction",
                title: "Python Guidelines",
                description: "PEP 8 standards",
                source: "awesome-copilot",
                requiresSetup: false,
                tags: ["python"],
            };
            expect(isUserRecommended(pythonAsset)).toBe(false);

            const reactAgent: CatalogueEntry = {
                id: "react-expert",
                type: "agent",
                title: "React Expert",
                description: "React component architecture",
                source: "awesome-copilot",
                requiresSetup: false,
                tags: ["react"],
            };
            expect(isUserRecommended(reactAgent)).toBe(false);
        });

        it("rejects assets that require setup", () => {
            const setupAsset: CatalogueEntry = {
                id: "mcp-debugger",
                type: "agent",
                title: "MCP Debugger",
                description: "Requires external MCP server connection",
                source: "awesome-copilot",
                requiresSetup: true,
                tags: ["debugger"],
            };
            expect(isUserRecommended(setupAsset)).toBe(false);
        });
    });

    describe("isRepoRecommended", () => {
        it("recommends matching tech assets for detected stack", () => {
            const tsAsset: CatalogueEntry = {
                id: "typescript-conventions",
                type: "instruction",
                title: "TypeScript Conventions",
                description: "Strict TypeScript rules and type safety",
                source: "awesome-copilot",
                requiresSetup: false,
                tags: ["typescript"],
            };
            expect(isRepoRecommended(tsAsset, ["typescript", "security"])).toBe(
                true
            );
        });

        it("isolates vendor-prefixed assets from generic matches", () => {
            const salesforceAsset: CatalogueEntry = {
                id: "salesforce-apex-security",
                type: "instruction",
                title: "Apex Security",
                description: "Security rules for Salesforce Apex code",
                source: "awesome-copilot",
                requiresSetup: false,
                tags: ["security"],
            };
            // Even though 'security' is in tags, 'salesforce' vendor is not detected
            expect(
                isRepoRecommended(salesforceAsset, ["security", "typescript"])
            ).toBe(false);
            // Once 'salesforce' is detected, it is allowed
            expect(
                isRepoRecommended(salesforceAsset, ["security", "salesforce"])
            ).toBe(true);
        });
    });

    describe("getRecommendedAssetIds", () => {
        const catalogue: CatalogueEntry[] = [
            {
                id: "clean-code",
                type: "instruction",
                title: "Clean Code",
                description: "Refactoring and clean code",
                source: "awesome-copilot",
                requiresSetup: false,
                tags: ["clean"],
            },
            {
                id: "python-guidelines",
                type: "instruction",
                title: "Python Guidelines",
                description: "Python best practices",
                source: "awesome-copilot",
                requiresSetup: false,
                tags: ["python"],
            },
            {
                id: "typescript-guidelines",
                type: "instruction",
                title: "TypeScript Guidelines",
                description: "TypeScript best practices",
                source: "awesome-copilot",
                requiresSetup: false,
                tags: ["typescript"],
            },
        ];

        it("returns user recommendations for user scope", () => {
            const ids = getRecommendedAssetIds(catalogue, "user");
            expect(ids.has("clean-code")).toBe(true);
            expect(ids.has("python-guidelines")).toBe(false);
            expect(ids.has("typescript-guidelines")).toBe(false);
        });

        it("returns repo recommendations for repo scope", () => {
            writeFileSync(join(tempDir, "tsconfig.json"), "{}", "utf-8");
            const ids = getRecommendedAssetIds(catalogue, "repo", tempDir);
            expect(ids.has("typescript-guidelines")).toBe(true);
            expect(ids.has("python-guidelines")).toBe(false);
        });
    });
});
