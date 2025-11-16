const esbuild = require("esbuild");

const isProduction = process.argv.includes("--production");
const isWatch = process.argv.includes("--watch") || process.argv.includes("watch");

const buildOptions = {
	entryPoints: ["src/extension.ts"],
	bundle: true,
	outfile: "out/extension.js",
	external: ["vscode"], // vscode is provided by the extension host
	format: "cjs",
	target: "node18",
	platform: "node",
	sourcemap: !isProduction,
	minify: isProduction,
	logLevel: "info",
};

if (isWatch) {
	esbuild
		.context(buildOptions)
		.then((context) => context.watch())
		.catch(() => process.exit(1));
} else {
	esbuild
		.build(buildOptions)
		.catch(() => process.exit(1));
}

