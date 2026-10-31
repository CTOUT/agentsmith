import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashString, hashFile, hashDirectory, hashAssetPath } from "./hash.js";

describe("hash utilities", () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = mkdtempSync(join(tmpdir(), "agentsmith-hash-"));
    });

    afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true });
    });

    it("normalises CRLF and LF to the same hash in hashString and hashFile", () => {
        const lf = "line1\nline2\n";
        const crlf = "line1\r\nline2\r\n";

        expect(hashString(lf)).toBe(hashString(crlf));

        const f1 = join(tempDir, "lf.md");
        const f2 = join(tempDir, "crlf.md");
        writeFileSync(f1, lf, "utf-8");
        writeFileSync(f2, crlf, "utf-8");

        expect(hashFile(f1)).toBe(hashFile(f2));
        expect(hashAssetPath(f1)).toBe(hashString(lf));
    });

    it("hashes directories deterministically and detects file edits", () => {
        const skillDir = join(tempDir, "my-skill");
        mkdirSync(join(skillDir, "scripts"), { recursive: true });
        writeFileSync(join(skillDir, "SKILL.md"), "# Skill\n", "utf-8");
        writeFileSync(
            join(skillDir, "scripts", "run.sh"),
            "echo ok\n",
            "utf-8"
        );

        const h1 = hashDirectory(skillDir);
        const h2 = hashAssetPath(skillDir);
        expect(h1).toBe(h2);

        // Modifying a nested file changes the directory hash
        writeFileSync(
            join(skillDir, "scripts", "run.sh"),
            "echo changed\n",
            "utf-8"
        );
        const h3 = hashDirectory(skillDir);
        expect(h3).not.toBe(h1);
    });

    it("hashes binary files by raw bytes without UTF-8 replacement collisions or CRLF corruption", () => {
        const skillDir = join(tempDir, "binary-skill");
        mkdirSync(skillDir, { recursive: true });
        writeFileSync(join(skillDir, "SKILL.md"), "# Binary Skill\n", "utf-8");

        const iconPath = join(skillDir, "icon.png");
        // PNG header contains \r\n (0x0d, 0x0a) followed by non-UTF8 bytes 0xff, 0xfe
        const bin1 = Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0xfe,
        ]);
        const bin2 = Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xfe, 0xff,
        ]);
        const binLf = Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0a, 0x1a, 0x0a, 0xff, 0xfe,
        ]);

        writeFileSync(iconPath, bin1);
        const fileHash1 = hashFile(iconPath);
        const dirHash1 = hashDirectory(skillDir);

        writeFileSync(iconPath, bin2);
        const fileHash2 = hashFile(iconPath);
        const dirHash2 = hashDirectory(skillDir);

        expect(fileHash1).not.toBe(fileHash2);
        expect(dirHash1).not.toBe(dirHash2);

        // Verify 0x0d 0x0a inside a binary file is not stripped as text CRLF
        writeFileSync(iconPath, binLf);
        const fileHashLf = hashFile(iconPath);
        expect(fileHash1).not.toBe(fileHashLf);
    });
});
