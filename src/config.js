import fs from "fs-extra";
import path from "path";
export async function loadConfig(root) {
    const configPaths = [
        path.join(root, ".saferenamerc.json"),
        path.join(root, ".saferenamerc"),
        path.join(root, "safe-rename.config.json"),
        path.join(root, "package.json"),
    ];
    // Try to find config file
    for (const configPath of configPaths) {
        if (await fs.pathExists(configPath)) {
            try {
                if (configPath.endsWith("package.json")) {
                    // Look for safeRename field in package.json
                    const packageJson = await fs.readJson(configPath);
                    if (packageJson.safeRename) {
                        return packageJson.safeRename;
                    }
                }
                else {
                    // Direct config file
                    const config = await fs.readJson(configPath);
                    return config;
                }
            }
            catch (error) {
                console.warn(`⚠️  Failed to load config from ${configPath}: ${error}`);
            }
        }
    }
    // Return default config if no file found
    return getDefaultConfig();
}
export function getDefaultConfig() {
    return {
        updatePackage: false,
        updateRemote: false,
        caseSensitive: false,
        dry: false,
        ignore: [
            "node_modules/**",
            "dist/**",
            "build/**",
            ".git/**",
            "**/coverage/**",
            "**/*.log",
        ],
        include: [
            "**/*.{ts,tsx,js,jsx}",
            "**/*.{json,yml,yaml}",
            "**/*.env*",
            "**/Dockerfile*",
            "**/docker-compose*",
            "**/*.md",
        ],
        concurrency: 10,
    };
}
export function mergeConfigWithArgs(config, args) {
    return {
        ...config,
        updatePackage: args["update-package"] ?? config.updatePackage,
        updateRemote: args["update-remote"] ?? config.updateRemote,
        caseSensitive: args["case-sensitive"] ?? config.caseSensitive,
        dry: args.dry ?? config.dry,
        multiMap: args["multi-map"]
            ? JSON.parse(args["multi-map"])
            : config.multiMap,
        concurrency: args.concurrency ?? config.concurrency,
    };
}
