import { build, emptyDir } from "https://deno.land/x/dnt@0.40.0/mod.ts";

await emptyDir("./npm");

await build({
    entryPoints: ["./mod.ts"],
    outDir: "./npm",
    shims: {
        deno: true,
    },
    package: {
        name: "@juannpz/deno-server-tools",
        version: "0.1.0",
        description: "Server utilities for Deno using Hono",
        license: "MIT",
        repository: {
            type: "git",
            url: "git+https://github.com/tu-usuario/deno-server-tools.git",
        },
        bugs: {
            url: "https://github.com/tu-usuario/deno-server-tools/issues",
        },
        dependencies: {
            "hono": "^4.3.1"
        },
        devDependencies: {}
    },
});