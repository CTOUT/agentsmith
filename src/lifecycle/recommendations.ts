/**
 * Recommendation scoring and stack detection for user and repository scopes.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CatalogueEntry, Scope } from "../types.js";

/**
 * Known vendor and platform prefixes isolated from generic tech tags.
 */
export const VENDOR_PREFIXES: readonly string[] = [
    "amplitude",
    "atlassian",
    "aws",
    "azure",
    "datadog",
    "drupal",
    "firebase",
    "magento",
    "neon",
    "pagerduty",
    "salesforce",
    "shopify",
    "snowflake",
    "strapi",
    "stripe",
    "supabase",
    "twilio",
    "wordpress",
] as const;

/**
 * Tech-specific keywords that prevent an asset from being recommended at user level.
 */
export const USER_TECH_SPECIFIC_SEGMENTS: readonly string[] = [
    "csharp",
    "dotnet",
    "python",
    "java",
    "kotlin",
    "go",
    "rust",
    "ruby",
    "php",
    "swift",
    "typescript",
    "javascript",
    "react",
    "angular",
    "vue",
    "nextjs",
    "nuxt",
    "svelte",
    "ember",
    "laravel",
    "django",
    "android",
    "ios",
    "maui",
    "electron",
    "azure",
    "aws",
    "gcp",
    "terraform",
    "bicep",
    "kubernetes",
    "docker",
    "salesforce",
    "shopify",
    "drupal",
    "wordpress",
    "postgres",
    "mysql",
    "redis",
    "playwright",
    "powershell",
] as const;

/**
 * Positive keywords identifying general-purpose, cross-cutting engineering assets.
 */
export const USER_GENERAL_POSITIVE_SEGMENTS: readonly string[] = [
    "beast",
    "mode",
    "critical",
    "thinking",
    "review",
    "reviewer",
    "doublecheck",
    "mentor",
    "plan",
    "planner",
    "blueprint",
    "specification",
    "architect",
    "architecture",
    "tdd",
    "swe",
    "qa",
    "security",
    "owasp",
    "safety",
    "clean",
    "refactor",
    "debt",
    "engineer",
    "evaluator",
    "investigator",
    "documenter",
    "documentation",
    "accessibility",
    "a11y",
    "performance",
    "memory",
    "orchestrator",
    "debugger",
    "debug",
] as const;

/**
 * Inspects a repository directory to detect language, framework, and tooling signals.
 */
export function detectRepoStack(cwd: string = process.cwd()): string[] {
    const tags = new Set<string>();

    // Universal baseline recommendations for every codebase
    tags.add("security");
    tags.add("owasp");

    if (!existsSync(cwd)) {
        return Array.from(tags);
    }

    try {
        const entries = readdirSync(cwd, { withFileTypes: true });
        const fileNames = new Set<string>();
        const extensions = new Set<string>();

        for (const entry of entries) {
            if (
                entry.name === "node_modules" ||
                entry.name === ".git" ||
                entry.name === "dist" ||
                entry.name === "bin" ||
                entry.name === "obj"
            ) {
                continue;
            }
            fileNames.add(entry.name.toLowerCase());
            const dotIdx = entry.name.lastIndexOf(".");
            if (dotIdx > 0) {
                extensions.add(entry.name.slice(dotIdx).toLowerCase());
            }
        }

        // TypeScript / JavaScript
        if (
            extensions.has(".ts") ||
            extensions.has(".tsx") ||
            fileNames.has("tsconfig.json")
        ) {
            tags.add("typescript");
        }
        if (
            extensions.has(".js") ||
            extensions.has(".jsx") ||
            extensions.has(".mjs") ||
            fileNames.has("package.json")
        ) {
            tags.add("javascript");
        }

        // C# / .NET
        if (
            extensions.has(".cs") ||
            extensions.has(".csproj") ||
            extensions.has(".sln")
        ) {
            tags.add("csharp");
            tags.add("dotnet");
        }

        // Python
        if (
            extensions.has(".py") ||
            fileNames.has("requirements.txt") ||
            fileNames.has("pyproject.toml") ||
            fileNames.has("pipfile")
        ) {
            tags.add("python");
        }

        // Go
        if (extensions.has(".go") || fileNames.has("go.mod")) {
            tags.add("go");
        }

        // Rust
        if (extensions.has(".rs") || fileNames.has("cargo.toml")) {
            tags.add("rust");
        }

        // Java / Kotlin
        if (
            extensions.has(".java") ||
            fileNames.has("pom.xml") ||
            fileNames.has("build.gradle")
        ) {
            tags.add("java");
        }
        if (extensions.has(".kt") || extensions.has(".kts")) {
            tags.add("kotlin");
        }

        // Infrastructure
        if (extensions.has(".tf") || fileNames.has("main.tf")) {
            tags.add("terraform");
        }
        if (extensions.has(".bicep")) {
            tags.add("bicep");
            tags.add("azure");
        }
        if (extensions.has(".ps1") || extensions.has(".psm1")) {
            tags.add("powershell");
        }

        // Containers & Workflows
        if (
            fileNames.has("dockerfile") ||
            fileNames.has("docker-compose.yml") ||
            fileNames.has("compose.yaml")
        ) {
            tags.add("docker");
            tags.add("container");
        }
        if (existsSync(join(cwd, ".github", "workflows"))) {
            tags.add("github-actions");
        }
        if (
            fileNames.has("playwright.config.ts") ||
            fileNames.has("playwright.config.js")
        ) {
            tags.add("playwright");
        }

        // Inspect package.json dependencies if present
        const pkgPath = join(cwd, "package.json");
        if (existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
                    dependencies?: Record<string, string>;
                    devDependencies?: Record<string, string>;
                };
                const allDeps = {
                    ...pkg.dependencies,
                    ...pkg.devDependencies,
                };
                const depNames = Object.keys(allDeps).map((d) =>
                    d.toLowerCase()
                );
                if (
                    depNames.some(
                        (d) => d === "react" || d.startsWith("@types/react")
                    )
                ) {
                    tags.add("react");
                }
                if (depNames.some((d) => d === "next")) {
                    tags.add("nextjs");
                    tags.add("react");
                }
                if (depNames.some((d) => d.startsWith("@angular/"))) {
                    tags.add("angular");
                }
                if (depNames.some((d) => d === "vue")) {
                    tags.add("vue");
                }
                if (depNames.some((d) => d === "nuxt")) {
                    tags.add("nuxt");
                }
                if (depNames.some((d) => d === "svelte")) {
                    tags.add("svelte");
                }
                if (depNames.some((d) => d.startsWith("@nestjs/"))) {
                    tags.add("nestjs");
                }
                if (depNames.some((d) => d === "electron")) {
                    tags.add("electron");
                }
            } catch {
                // Ignore package.json parsing error
            }
        }
    } catch {
        // Fallback to baseline on read error
    }

    return Array.from(tags);
}

/**
 * Determines whether a catalogue entry is recommended for repository scope given detected stack tags.
 */
export function isRepoRecommended(
    entry: CatalogueEntry,
    tags: readonly string[]
): boolean {
    if (entry.requiresSetup) {
        return false;
    }

    if (tags.length === 0) {
        return false;
    }

    const segments = entry.id.toLowerCase().split("-");
    const firstSegment = segments[0] ?? "";

    // Vendor isolation: do not recommend vendor-prefixed assets unless the vendor was explicitly detected
    if (
        VENDOR_PREFIXES.includes(firstSegment) &&
        !tags.includes(firstSegment)
    ) {
        return false;
    }

    const tagSet = new Set(tags.map((t) => t.toLowerCase()));
    let score = 0;

    // Dash segments in asset ID (weight 2)
    for (const segment of segments) {
        if (tagSet.has(segment)) {
            score += 2;
        }
    }

    // Title word match (weight 2)
    const titleWords = entry.title.toLowerCase().split(/[^a-z0-9_-]+/);
    for (const word of titleWords) {
        if (tagSet.has(word)) {
            score += 2;
        }
    }

    // Asset tags match (weight 2)
    for (const tag of entry.tags) {
        if (tagSet.has(tag.toLowerCase())) {
            score += 2;
        }
    }

    // Description word match (weight 1)
    const descWords = entry.description.toLowerCase().split(/[^a-z0-9_-]+/);
    for (const word of descWords) {
        if (tagSet.has(word)) {
            score += 1;
        }
    }

    return score >= 2;
}

/**
 * Determines whether a catalogue entry is recommended for user scope (tech-agnostic baseline).
 */
export function isUserRecommended(entry: CatalogueEntry): boolean {
    if (entry.requiresSetup) {
        return false;
    }

    const idLower = entry.id.toLowerCase();
    const titleLower = entry.title.toLowerCase();
    const descLower = entry.description.toLowerCase();
    const segments = idLower.split("-");

    // 1. Negative filter: tech-specific keywords
    for (const tech of USER_TECH_SPECIFIC_SEGMENTS) {
        if (segments.includes(tech)) {
            return false;
        }
        const regex = new RegExp(`\\b${tech}\\b`, "i");
        if (regex.test(titleLower)) {
            return false;
        }
    }

    // 2. Positive filter: general engineering practices
    for (const pos of USER_GENERAL_POSITIVE_SEGMENTS) {
        if (segments.includes(pos)) {
            return true;
        }
        const regex = new RegExp(`\\b${pos}\\b`, "i");
        if (regex.test(titleLower)) {
            return true;
        }
    }

    // 3. Description signals for cross-cutting practices
    const positiveDescPatterns = [
        /\bcode review\b/i,
        /\bclean code\b/i,
        /\brefactor\b/i,
        /\bdebugging\b/i,
        /\bunit test\b/i,
        /\bsoftware architect\b/i,
        /\bdesign pattern\b/i,
        /\bsecurity audit\b/i,
        /\baccessibility\b/i,
        /\ba11y\b/i,
        /\bdocumentation\b/i,
    ];

    for (const pattern of positiveDescPatterns) {
        if (pattern.test(descLower)) {
            return true;
        }
    }

    return false;
}

/**
 * Returns the set of recommended asset IDs for a given scope and workspace.
 */
export function getRecommendedAssetIds(
    catalogue: readonly CatalogueEntry[],
    scope: Scope,
    cwd: string = process.cwd()
): Set<string> {
    const recommended = new Set<string>();

    if (scope === "user") {
        for (const entry of catalogue) {
            if (isUserRecommended(entry)) {
                recommended.add(entry.id);
            }
        }
    } else {
        const stackTags = detectRepoStack(cwd);
        for (const entry of catalogue) {
            if (isRepoRecommended(entry, stackTags)) {
                recommended.add(entry.id);
            }
        }
    }

    return recommended;
}
