import { describe, it, expect } from "vitest";
import { join } from "node:path";
import {
    getTargetAdapter,
    getTargetTypeLabel,
    getTargetTypePlural,
    isValidScope,
    isValidTarget,
    normaliseTargetAssetType,
} from "./index.js";

describe("target adapters", () => {
    const cwd = join("/workspace", "project");
    const home = join("/home", "user");

    it("validates target and scope identifiers", () => {
        expect(isValidTarget("vscode")).toBe(true);
        expect(isValidTarget("kiro")).toBe(true);
        expect(isValidTarget("antigravity")).toBe(true);
        expect(isValidTarget("unknown")).toBe(false);

        expect(isValidScope("repo")).toBe(true);
        expect(isValidScope("user")).toBe(true);
        expect(isValidScope("global")).toBe(false);
    });

    it("resolves confirmed repo and user paths across all three targets", () => {
        const vscode = getTargetAdapter("vscode");
        expect(
            vscode.resolveTargetPath("ts", "instruction", "repo", cwd, home)
        ).toBe(join(cwd, ".github", "instructions", "ts.instructions.md"));
        expect(
            vscode.resolveTargetPath("ts", "instruction", "user", cwd, home)
        ).toBe(join(home, ".copilot", "instructions", "ts.instructions.md"));
        expect(
            vscode.resolveTargetPath("rev", "agent", "repo", cwd, home)
        ).toBe(join(cwd, ".github", "agents", "rev.agent.md"));
        expect(
            vscode.resolveTargetPath("web", "skill", "repo", cwd, home)
        ).toBe(join(cwd, ".github", "skills", "web"));

        const kiro = getTargetAdapter("kiro");
        expect(
            kiro.resolveTargetPath("ts", "instruction", "repo", cwd, home)
        ).toBe(join(cwd, ".kiro", "steering", "ts.md"));
        expect(
            kiro.resolveTargetPath("ts", "instruction", "user", cwd, home)
        ).toBe(join(home, ".kiro", "steering", "ts.md"));
        expect(kiro.resolveTargetPath("rev", "agent", "repo", cwd, home)).toBe(
            join(cwd, ".kiro", "agents", "rev.md")
        );
        expect(kiro.resolveTargetPath("web", "skill", "user", cwd, home)).toBe(
            join(home, ".kiro", "skills", "web")
        );

        const antigravity = getTargetAdapter("antigravity");
        expect(
            antigravity.resolveTargetPath(
                "ts",
                "instruction",
                "repo",
                cwd,
                home
            )
        ).toBe(join(cwd, ".agents", "rules", "ts.md"));
        expect(
            antigravity.resolveTargetPath(
                "ts",
                "instruction",
                "user",
                cwd,
                home
            )
        ).toBe(join(home, ".gemini", "config", "rules", "ts.md"));
        expect(
            antigravity.resolveTargetPath("rev", "agent", "repo", cwd, home)
        ).toBe(join(cwd, ".agents", "plugins", "rev", "agents", "rev.md"));
        expect(
            antigravity.resolveTargetPath("web", "skill", "user", cwd, home)
        ).toBe(
            join(home, ".gemini", "config", "plugins", "web", "skills", "web")
        );
    });

    it("rejects path traversal in assetId across all targets", () => {
        for (const target of ["vscode", "kiro", "antigravity"] as const) {
            const adapter = getTargetAdapter(target);
            expect(() =>
                adapter.resolveTargetPath(
                    "../../../etc/passwd",
                    "instruction",
                    "repo",
                    cwd,
                    home
                )
            ).toThrow(/Security: path/);
        }
    });

    it("translates VS Code applyTo frontmatter for Kiro and Antigravity", () => {
        const sourceMd = [
            "---",
            "description: 'TypeScript rules'",
            'applyTo: "**/*.ts"',
            "---",
            "# Rules",
            "Strict types.",
        ].join("\n");

        const vscodeRes = getTargetAdapter("vscode").adaptContent(
            sourceMd,
            "instruction"
        );
        expect(vscodeRes.outcome).toBe("native");

        const kiroRes = getTargetAdapter("kiro").adaptContent(
            sourceMd,
            "instruction"
        );
        expect(kiroRes.outcome).toBe("adapted");
        expect(kiroRes.content).toContain("inclusion: fileMatch");
        expect(kiroRes.content).toContain('fileMatchPattern: "**/*.ts"');
        expect(kiroRes.content).not.toContain("applyTo:");

        const agRes = getTargetAdapter("antigravity").adaptContent(
            sourceMd,
            "instruction"
        );
        expect(agRes.outcome).toBe("adapted");
        expect(agRes.content).toContain("trigger: glob");
        expect(agRes.content).toContain('globs: "**/*.ts"');
        expect(agRes.content).not.toContain("applyTo:");
    });

    it("translates wildcard applyTo to always / always_on", () => {
        const wildcardMd = [
            "---",
            'applyTo: "**"',
            "---",
            "# Global Rules",
        ].join("\n");

        const kiroRes = getTargetAdapter("kiro").adaptContent(
            wildcardMd,
            "instruction"
        );
        expect(kiroRes.outcome).toBe("adapted");
        expect(kiroRes.content).toContain("inclusion: always");

        const agRes = getTargetAdapter("antigravity").adaptContent(
            wildcardMd,
            "instruction"
        );
        expect(agRes.outcome).toBe("adapted");
        expect(agRes.content).toContain("trigger: always_on");
    });

    it("reports unsupported asset types cleanly", () => {
        const res = getTargetAdapter("vscode").adaptContent(
            "# Workflow",
            "workflow"
        );
        expect(res.outcome).toBe("unsupported");
        expect(res.reason).toContain("not supported");
    });

    it("maps target-specific terminology correctly", () => {
        expect(getTargetTypeLabel("instruction", "vscode")).toBe("instruction");
        expect(getTargetTypePlural("instruction", "vscode")).toBe(
            "instructions"
        );

        expect(getTargetTypeLabel("instruction", "kiro")).toBe("steering");
        expect(getTargetTypePlural("instruction", "kiro")).toBe("steering");

        expect(getTargetTypeLabel("instruction", "antigravity")).toBe("rule");
        expect(getTargetTypePlural("instruction", "antigravity")).toBe("rules");

        expect(getTargetTypeLabel("agent", "kiro")).toBe("agent");
        expect(getTargetTypePlural("agent", "kiro")).toBe("agents");

        expect(getTargetTypeLabel("skill", "antigravity")).toBe("skill");
        expect(getTargetTypePlural("skill", "antigravity")).toBe("skills");

        expect(normaliseTargetAssetType("steering")).toBe("instruction");
        expect(normaliseTargetAssetType("rules")).toBe("instruction");
        expect(normaliseTargetAssetType("instructions")).toBe("instruction");
        expect(normaliseTargetAssetType("agents")).toBe("agent");
        expect(normaliseTargetAssetType("skills")).toBe("skill");
        expect(normaliseTargetAssetType("invalid")).toBeUndefined();
    });
});
