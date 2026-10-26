import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        cli: "src/cli.ts",
        index: "src/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    shims: true, // adds __dirname/__filename shims for ESM
    banner: {
        // ensures the CLI entry is executable
        js: "",
    },
});
