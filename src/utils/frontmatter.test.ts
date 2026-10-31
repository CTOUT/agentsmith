import { describe, it, expect } from "vitest";
import { parseFrontmatter, serialiseFrontmatter } from "./frontmatter.js";

describe("frontmatter utilities", () => {
    it("parses frontmatter with scalar, boolean, and inline array fields", () => {
        const md = [
            "---",
            "title: TypeScript Best Practices",
            'applyTo: "**/*.ts"',
            "requiresSetup: true",
            "tags: ['typescript', 'linting']",
            "---",
            "# Heading",
            "Body text.",
        ].join("\n");

        const parsed = parseFrontmatter(md);
        expect(parsed.hasFrontmatter).toBe(true);
        expect(parsed.attributes).toEqual({
            title: "TypeScript Best Practices",
            applyTo: "**/*.ts",
            requiresSetup: true,
            tags: ["typescript", "linting"],
        });
        expect(parsed.body).toBe("# Heading\nBody text.");
    });

    it("parses block list values and CRLF line endings", () => {
        const md = [
            "---",
            "description: 'Agent for testing'",
            "tools:",
            "  - bash",
            "  - edit",
            "---",
            "Agent content",
        ].join("\r\n");

        const parsed = parseFrontmatter(md);
        expect(parsed.hasFrontmatter).toBe(true);
        expect(parsed.attributes.description).toBe("Agent for testing");
        expect(parsed.attributes.tools).toEqual(["bash", "edit"]);
        expect(parsed.body).toBe("Agent content");
    });

    it("handles documents without frontmatter", () => {
        const md = "# Plain Document\n\nNo frontmatter here.";
        const parsed = parseFrontmatter(md);
        expect(parsed.hasFrontmatter).toBe(false);
        expect(parsed.attributes).toEqual({});
        expect(parsed.body).toBe(md);
    });

    it("serialises attributes and body back into valid frontmatter markdown", () => {
        const output = serialiseFrontmatter(
            {
                inclusion: "fileMatch",
                fileMatchPattern: "**/*.ts",
                tags: ["ts", "strict"],
            },
            "# Rules\nAlways use strict mode."
        );

        expect(output).toContain('fileMatchPattern: "**/*.ts"');
        expect(output).toContain("inclusion: fileMatch");
        expect(output).toContain('tags: ["ts", "strict"]');

        const reparsed = parseFrontmatter(output);
        expect(reparsed.hasFrontmatter).toBe(true);
        expect(reparsed.attributes.inclusion).toBe("fileMatch");
        expect(reparsed.attributes.fileMatchPattern).toBe("**/*.ts");
        expect(reparsed.body).toBe("# Rules\nAlways use strict mode.");
    });

    it("parses folded (>) and literal (|) multi-line YAML block scalars without treating indented colons as top-level keys", () => {
        const md = [
            "---",
            "title: Complex Asset",
            "description: >",
            "  Use TypeScript strict mode.",
            "  Note: avoid any types.",
            "  ",
            "  Second paragraph.",
            "notes: |",
            "  Line one: alpha",
            "  Line two: beta",
            "mcpServers:",
            "  github:",
            "    command: npx",
            'applyTo: "**/*.ts"',
            "---",
            "# Body",
        ].join("\n");

        const parsed = parseFrontmatter(md);
        expect(parsed.hasFrontmatter).toBe(true);
        expect(parsed.attributes.title).toBe("Complex Asset");
        expect(parsed.attributes.description).toBe(
            "Use TypeScript strict mode. Note: avoid any types.\nSecond paragraph."
        );
        expect(parsed.attributes.notes).toBe("Line one: alpha\nLine two: beta");
        expect(parsed.attributes.Note).toBeUndefined();
        expect(parsed.attributes.github).toBeUndefined();
        expect(parsed.attributes.applyTo).toBe("**/*.ts");

        // Round-trip serialisation preserves multi-line strings and quotes
        const serialised = serialiseFrontmatter(
            {
                description: parsed.attributes.description,
                quoteTest: 'Rule: avoid "any"',
            },
            parsed.body
        );
        const reparsed = parseFrontmatter(serialised);
        expect(reparsed.attributes.description).toBe(
            "Use TypeScript strict mode. Note: avoid any types.\nSecond paragraph."
        );
        expect(reparsed.attributes.quoteTest).toBe('Rule: avoid "any"');
    });

    it("handles UTF-8 BOM, trailing spaces on fences, and empty frontmatter blocks", () => {
        const withBomAndSpaces =
            '\uFEFF---   \ntitle: "BOM Asset"\n---  \n# Heading\nBody.';
        const parsed = parseFrontmatter(withBomAndSpaces);
        expect(parsed.hasFrontmatter).toBe(true);
        expect(parsed.attributes.title).toBe("BOM Asset");
        expect(parsed.body).toBe("# Heading\nBody.");

        const emptyFm = "---\n---\n# Empty Frontmatter\nContent.";
        const parsedEmpty = parseFrontmatter(emptyFm);
        expect(parsedEmpty.hasFrontmatter).toBe(true);
        expect(parsedEmpty.attributes).toEqual({});
        expect(parsedEmpty.body).toBe("# Empty Frontmatter\nContent.");
    });
});
