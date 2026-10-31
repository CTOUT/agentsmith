/**
 * Lightweight YAML frontmatter parser and serialiser for Markdown assets.
 */

export interface ParsedFrontmatter {
    attributes: Record<string, unknown>;
    body: string;
    hasFrontmatter: boolean;
}

function unquote(val: string): string {
    const trimmed = val.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        return trimmed
            .slice(1, -1)
            .replace(/\\n/g, "\n")
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, "\\");
    }
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
        return trimmed.slice(1, -1).replace(/''/g, "'");
    }
    return trimmed;
}

function escapeDoubleQuoted(str: string): string {
    return str
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n");
}

function parseScalarValue(raw: string): unknown {
    const trimmed = raw.trim();
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        const inner = trimmed.slice(1, -1).trim();
        if (!inner) return [];
        return inner.split(",").map((item) => unquote(item));
    }
    return unquote(trimmed);
}

function parseBlockScalar(lines: string[], indicator: string): string {
    const isFolded = indicator.startsWith(">");
    const nonEmpty = lines.filter((l) => l.trim().length > 0);
    if (nonEmpty.length === 0) return "";

    const minIndent = Math.min(
        ...nonEmpty.map((l) => {
            const m = l.match(/^ +/);
            return m ? m[0].length : 0;
        })
    );

    const strippedLines = lines.map((l) =>
        l.length >= minIndent ? l.slice(minIndent) : l.trim()
    );

    // Trim leading/trailing empty lines from block
    while (strippedLines.length > 0 && strippedLines[0].trim() === "") {
        strippedLines.shift();
    }
    while (
        strippedLines.length > 0 &&
        strippedLines[strippedLines.length - 1].trim() === ""
    ) {
        strippedLines.pop();
    }

    if (!isFolded) {
        return strippedLines.join("\n");
    }

    // Folded block (>): join consecutive non-empty lines with spaces, preserve blank lines as \n
    const paragraphs: string[] = [];
    let current: string[] = [];
    for (const line of strippedLines) {
        if (line.trim() === "") {
            if (current.length > 0) {
                paragraphs.push(current.join(" "));
                current = [];
            }
        } else {
            current.push(line.trim());
        }
    }
    if (current.length > 0) {
        paragraphs.push(current.join(" "));
    }
    return paragraphs.join("\n");
}

/**
 * Parses YAML frontmatter delimited by `---` at the start of a Markdown document.
 */
export function parseFrontmatter(content: string): ParsedFrontmatter {
    const normalised = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
    const match = normalised.match(
        /^---[ \t]*\n(?:([\s\S]*?)\n)?---[ \t]*(?:\n+|$)([\s\S]*)$/
    );
    if (!match) {
        return {
            attributes: {},
            body: normalised,
            hasFrontmatter: false,
        };
    }

    const yamlBlock = match[1] ?? "";
    const body = match[2];
    const attributes: Record<string, unknown> = {};

    const lines = yamlBlock.split("\n");
    let currentListKey: string | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }

        const isIndented = /^\s/.test(line);

        if (trimmed.startsWith("- ") && currentListKey) {
            const list = attributes[currentListKey];
            if (Array.isArray(list)) {
                list.push(unquote(trimmed.slice(2)));
            }
            continue;
        }

        // Ignore other indented lines (e.g. nested objects) so they are not parsed as top-level keys
        if (isIndented) {
            continue;
        }

        const colonIndex = line.indexOf(":");
        if (colonIndex === -1) {
            currentListKey = null;
            continue;
        }

        const key = line.slice(0, colonIndex).trim();
        const rawValue = line.slice(colonIndex + 1).trim();

        if (!key) {
            currentListKey = null;
            continue;
        }

        if (/^[|>][-+]?$/.test(rawValue)) {
            currentListKey = null;
            const blockLines: string[] = [];
            while (i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                if (nextLine.trim() === "" || /^\s+/.test(nextLine)) {
                    blockLines.push(nextLine);
                    i++;
                } else {
                    break;
                }
            }
            attributes[key] = parseBlockScalar(blockLines, rawValue);
        } else if (rawValue === "") {
            attributes[key] = [];
            currentListKey = key;
        } else {
            attributes[key] = parseScalarValue(rawValue);
            currentListKey = null;
        }
    }

    return {
        attributes,
        body,
        hasFrontmatter: true,
    };
}

function formatYamlValue(value: unknown): string {
    if (typeof value === "boolean" || typeof value === "number") {
        return String(value);
    }
    if (Array.isArray(value)) {
        const items = value
            .map((item) => `"${escapeDoubleQuoted(String(item))}"`)
            .join(", ");
        return `[${items}]`;
    }
    const str = String(value ?? "");
    if (
        str.includes(":") ||
        str.includes("*") ||
        str.includes("#") ||
        str.includes("[") ||
        str.includes("]") ||
        str.includes("{") ||
        str.includes("}") ||
        str.includes('"') ||
        str.includes("'") ||
        str.includes("\n") ||
        str.startsWith(">") ||
        str.startsWith("|") ||
        str.startsWith(" ") ||
        str.endsWith(" ")
    ) {
        return `"${escapeDoubleQuoted(str)}"`;
    }
    return str;
}

/**
 * Serialises frontmatter attributes and Markdown body back into a single document.
 */
export function serialiseFrontmatter(
    attributes: Record<string, unknown>,
    body: string
): string {
    const keys = Object.keys(attributes).filter(
        (key) => attributes[key] !== undefined
    );
    const normalisedBody = body.replace(/\r\n/g, "\n").replace(/^\n+/, "");

    if (keys.length === 0) {
        return normalisedBody;
    }

    const yamlLines = keys.map(
        (key) => `${key}: ${formatYamlValue(attributes[key])}`
    );

    return `---\n${yamlLines.join("\n")}\n---\n\n${normalisedBody}`;
}
