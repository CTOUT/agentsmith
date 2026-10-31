import { describe, it, expect } from "vitest";
import type { CatalogueEntry } from "../types.js";
import {
    centreAndPad,
    cleanDescription,
    filterCatalogueBySearch,
    getTargetDisplayPath,
    truncateAndPad,
} from "./picker.js";

describe("filterCatalogueBySearch", () => {
    const catalogue: CatalogueEntry[] = [
        {
            id: "typescript-conventions",
            type: "instruction",
            title: "TypeScript Conventions",
            description: "Strict TypeScript rules and type safety",
            source: "awesome-copilot",
            requiresSetup: false,
            tags: ["typescript", "standards"],
        },
        {
            id: "se-security-reviewer",
            type: "agent",
            title: "Security Reviewer",
            description: "Automated vulnerability and OWASP security review",
            source: "awesome-copilot",
            requiresSetup: false,
            tags: ["security", "owasp"],
        },
        {
            id: "refactor-skill",
            type: "skill",
            title: "Code Refactoring",
            description: "Automated code smell cleanup",
            source: "awesome-copilot",
            requiresSetup: false,
            tags: ["refactor", "cleanup"],
        },
        {
            id: "python-flask",
            type: "instruction",
            title: "Flask Architecture",
            description: "Flask backend standards",
            source: "awesome-copilot",
            requiresSetup: false,
            tags: ["python", "flask"],
        },
    ];

    it("filters by asset ID, title, and description tokens", () => {
        const results = filterCatalogueBySearch(
            catalogue,
            "typescript",
            "vscode"
        );
        expect(results).toHaveLength(1);
        expect(results[0]?.id).toBe("typescript-conventions");
    });

    it("matches target-specific terminology: 'steering' on Kiro", () => {
        const kiroResults = filterCatalogueBySearch(
            catalogue,
            "steering",
            "kiro"
        );
        expect(kiroResults.map((r) => r.id)).toEqual(
            expect.arrayContaining(["typescript-conventions", "python-flask"])
        );

        const agResults = filterCatalogueBySearch(
            catalogue,
            "rule",
            "antigravity"
        );
        expect(agResults.map((r) => r.id)).toEqual(
            expect.arrayContaining(["typescript-conventions", "python-flask"])
        );

        const vsResults = filterCatalogueBySearch(
            catalogue,
            "instruction",
            "vscode"
        );
        expect(vsResults.map((r) => r.id)).toEqual(
            expect.arrayContaining(["typescript-conventions", "python-flask"])
        );
    });

    it("matches multiple tokens across fields", () => {
        const results = filterCatalogueBySearch(
            catalogue,
            "security agent",
            "vscode"
        );
        expect(results).toHaveLength(1);
        expect(results[0]?.id).toBe("se-security-reviewer");
    });

    it("supports acronym and tech alias matching", () => {
        const results = filterCatalogueBySearch(catalogue, "ts", "vscode");
        expect(results.some((r) => r.id === "typescript-conventions")).toBe(
            true
        );
    });

    it("does not match false-positive subsequences for words like react", () => {
        const testCatalogue: CatalogueEntry[] = [
            {
                id: "react-components",
                type: "instruction",
                title: "React Components",
                description: "React standards",
                source: "awesome-copilot",
                requiresSetup: false,
                tags: ["react"],
            },
            {
                id: "rebase-current-branch",
                type: "skill",
                title: "Rebase Branch",
                description: "Git rebase workflow",
                source: "awesome-copilot",
                requiresSetup: false,
                tags: ["git"],
            },
            {
                id: "refactor-clean",
                type: "skill",
                title: "Refactor Code",
                description: "Refactoring standards",
                source: "awesome-copilot",
                requiresSetup: false,
                tags: ["refactor"],
            },
        ];
        const results = filterCatalogueBySearch(
            testCatalogue,
            "react",
            "vscode"
        );
        expect(results).toHaveLength(1);
        expect(results[0]?.id).toBe("react-components");
    });

    it("returns empty array when no assets match", () => {
        const results = filterCatalogueBySearch(
            catalogue,
            "missing-xyz",
            "vscode"
        );
        expect(results).toHaveLength(0);
    });
});

describe("cleanDescription", () => {
    it("collapses multi-line text, bullet points, and excess whitespace into single line", () => {
        const input = `
            Enforce output quality across security audits.
            - Generating a compliance report
            * Comparing agent frameworks
            • Verifying code locations
            + Checking quality thresholds
        `;
        const cleaned = cleanDescription(input);
        expect(cleaned).toBe(
            "Enforce output quality across security audits. Generating a compliance report Comparing agent frameworks Verifying code locations Checking quality thresholds"
        );
    });

    it("handles already clean single-line descriptions without modification", () => {
        expect(cleanDescription("Simple clean description")).toBe(
            "Simple clean description"
        );
    });
});

describe("truncateAndPad", () => {
    it("pads strings shorter than the target width with trailing spaces", () => {
        const padded = truncateAndPad("test", 10);
        expect(padded).toBe("test      ");
        expect(padded.length).toBe(10);
    });

    it("truncates strings longer than target width with ellipsis", () => {
        const truncated = truncateAndPad("very long description", 10);
        expect(truncated).toBe("very long…");
        expect(truncated.length).toBe(10);
    });

    it("preserves exact length when string matches width exactly", () => {
        const exact = truncateAndPad("12345", 5);
        expect(exact).toBe("12345");
        expect(exact.length).toBe(5);
    });
});

describe("centreAndPad", () => {
    it("centres strings within the specified width with symmetric padding", () => {
        const centred = centreAndPad("TYPE", 10);
        expect(centred).toBe("   TYPE   ");
        expect(centred.length).toBe(10);
    });

    it("handles odd remaining space by giving extra space to the right", () => {
        const centred = centreAndPad("ABC", 6);
        expect(centred).toBe(" ABC  ");
        expect(centred.length).toBe(6);
    });

    it("returns unchanged string when string length equals or exceeds width", () => {
        expect(centreAndPad("EXACT", 5)).toBe("EXACT");
        expect(centreAndPad("LONGER", 4)).toBe("LONGER");
    });
});

describe("getTargetDisplayPath", () => {
    it("resolves repo-scoped destination paths for kiro", () => {
        const path = getTargetDisplayPath(
            "my-asset",
            "instruction",
            "kiro",
            "repo"
        );
        expect(path).toContain(".kiro/steering/my-asset.md");
    });

    it("resolves repo-scoped destination paths for antigravity", () => {
        const path = getTargetDisplayPath(
            "my-asset",
            "instruction",
            "antigravity",
            "repo"
        );
        expect(path).toContain(".agents/rules/my-asset.md");
    });

    it("resolves repo-scoped destination paths for vscode", () => {
        const path = getTargetDisplayPath(
            "my-asset",
            "instruction",
            "vscode",
            "repo"
        );
        expect(path).toContain(".github/instructions/my-asset.instructions.md");
    });

    it("resolves user-scoped paths with tilde prefix", () => {
        const path = getTargetDisplayPath(
            "my-asset",
            "instruction",
            "kiro",
            "user"
        );
        expect(path.startsWith("~")).toBe(true);
        expect(path).toContain(".kiro/steering/my-asset.md");
    });
});
