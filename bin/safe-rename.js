#!/usr/bin/env bun
import minimist from "minimist";
import { runSafeRename } from "../src/engine";
import { loadConfig } from "../src/config";
import { analyzeRepo } from "../src/planner";
import { validateRenameOptions, validateMultiMap, formatValidationErrors } from "../src/validation";
import { outro, text, select, confirm, multiselect, spinner, note, cancel } from "@clack/prompts";
import fs from "fs-extra";
import path from "path";
// Beautiful CLI visualization functions
function showBox(title, content, width = 60) {
    const padding = " ".repeat(Math.max(0, width - title.length - 4));
    const border = "─".repeat(width);
    console.log(`┌${border}┐`);
    console.log(`│  ${title}${padding}│`);
    console.log(`│${border}│`);
    const lines = content.split('\n');
    lines.forEach(line => {
        const linePadding = " ".repeat(Math.max(0, width - line.length - 4));
        console.log(`│  ${line}${linePadding}│`);
    });
    console.log(`└${border}┘`);
}
function showScriptBox(script, explanation) {
    const scriptWidth = Math.max(script.length + 4, 40);
    const scriptBorder = "─".repeat(scriptWidth);
    const expWidth = Math.max(explanation.length + 4, 60);
    const expBorder = "─".repeat(expWidth);
    console.log(`◇  Your script:`);
    console.log(`│`);
    console.log(`│  ${script}`);
    console.log(`│`);
    console.log(`└${scriptBorder}┘`);
    console.log(`◇  Explanation:`);
    console.log(`│`);
    const expLines = explanation.split('\n');
    expLines.forEach((line, index) => {
        const linePadding = " ".repeat(Math.max(0, expWidth - line.length - 4));
        console.log(`│  ${line}${linePadding}│`);
    });
    console.log(`│`);
    console.log(`└${expBorder}┘`);
}
function showConfirmBox(question) {
    const width = Math.max(question.length + 8, 50);
    const border = "─".repeat(width);
    console.log(`◆  Run this script?`);
    console.log(`│`);
    console.log(`│  ${question}`);
    console.log(`│`);
    console.log(`└${border}┘`);
    console.log(`│  ● ✅ Yes (Lets go!)`);
    console.log(`│  ○ 📝 Revise`);
    console.log(`│  ○ ❌ Cancel`);
    console.log(`└${border}┘`);
}
function showProgress(title, message) {
    const width = Math.max(title.length + message.length + 8, 60);
    const border = "─".repeat(width);
    console.log(`┌${border}┐`);
    console.log(`│  🔄 ${title}${" ".repeat(width - title.length - message.length - 12)}${message} │`);
    console.log(`└${border}┘`);
}
function showSuccess(message) {
    const width = message.length + 8;
    const border = "─".repeat(width);
    console.log(`┌${border}┐`);
    console.log(`│  ✅ ${message} │`);
    console.log(`└${border}┘`);
}
function showError(message) {
    const width = message.length + 8;
    const border = "─".repeat(width);
    console.log(`┌${border}┐`);
    console.log(`│  ❌ ${message} │`);
    console.log(`└${border}┘`);
}
const args = minimist(process.argv.slice(2), {
    alias: {
        h: "help",
        v: "version",
        o: "old-name",
        n: "new-name",
        d: "dry",
        c: "case-sensitive",
        u: "update-package",
        r: "update-remote",
        m: "multi-map",
        j: "concurrency"
    },
    boolean: ["help", "version", "dry", "case-sensitive", "update-package", "update-remote", "interactive"],
    string: ["old-name", "new-name", "multi-map", "concurrency"],
    default: {
        concurrency: "10"
    }
});
function showHelp() {
    console.log(`
🚀 Safe Rename - Enterprise-grade repository refactoring tool

USAGE:
  safe-rename [OPTIONS] --old-name <OLD> --new-name <NEW>
  safe-rename --interactive
  safe-rename --analyze
  safe-rename --help

REQUIRED OPTIONS:
  -o, --old-name <NAME>        Old name to rename
  -n, --new-name <NAME>        New name to rename to

OPTIONAL OPTIONS:
  -d, --dry                    Preview changes without executing (default: false)
  -c, --case-sensitive         Case-sensitive rename (default: false)
  -u, --update-package         Update package.json dependencies (default: false)
  -r, --update-remote          Update git remotes (default: false)
  -m, --multi-map <JSON>       Multi-map for batch renames (JSON format)
  -j, --concurrency <NUM>      Number of concurrent files to process (default: 10)

INTERACTIVE MODE:
  -i, --interactive            Launch interactive CLI wizard

ANALYSIS MODE:
  -a, --analyze                Analyze repository for rename suggestions

CONFIGURATION:
  --config <PATH>              Path to config file (default: .saferenamerc.json)
  --show-config               Show current configuration

OUTPUT OPTIONS:
  --verbose                    Show detailed output
  --quiet                      Suppress non-error output
  --progress                   Show progress bar

EXAMPLES:
  # Basic rename
  safe-rename --old-name "old-pkg" --new-name "new-pkg"

  # Dry run with package.json updates
  safe-rename --old-name "old-pkg" --new-name "new-pkg" --dry --update-package

  # Interactive mode
  safe-rename --interactive

  # Multi-map rename
  safe-rename --old-name "pkg1" --new-name "newpkg1" --multi-map '{"pkg1": "newpkg1", "pkg2": "newpkg2"}'

  # Analyze repository
  safe-rename --analyze

CONFIGURATION FILE:
  Create .saferenamerc.json in your project root:

  {
    "updatePackage": true,
    "updateRemote": false,
    "caseSensitive": false,
    "dry": false,
    "concurrency": 10,
    "ignore": ["node_modules/**", "dist/**"],
    "include": ["**/*.{ts,tsx,js,jsx,json,yaml,yml,env,md}"]
  }

For more information, visit: https://github.com/neopilotai/safe-rename
`);
}
function showVersion() {
    const packageJson = fs.readJsonSync(path.join(__dirname, "../package.json"));
    console.log(`Safe Rename v${packageJson.version}`);
}
async function showConfig() {
    try {
        const config = await loadConfig(process.cwd());
        console.log("Current configuration:");
        console.log(JSON.stringify(config, null, 2));
    }
    catch (error) {
        console.error("❌ Failed to load config:", error);
        process.exit(1);
    }
}
async function analyzeRepository() {
    showScriptBox("safe-rename --analyze", "Scans repository files to identify frequently used tokens.\n" +
        "Analyzes imports, exports, environment variables, and patterns.\n" +
        "Shows top 20 most common tokens for rename suggestions.");
    showConfirmBox("Analyze current repository?");
    const s = spinner();
    showProgress("Repository Analysis", "Scanning files and patterns...");
    s.start();
    try {
        const analysis = await analyzeRepo(process.cwd());
        s.stop();
        if (analysis.topTokens.length === 0) {
            showBox("Analysis Results", "No frequent tokens found in your repository.\n\nTry running on a larger codebase or check file patterns.");
            return;
        }
        let resultContent = "Top 20 Most Frequent Tokens:\n";
        resultContent += "─".repeat(50) + "\n";
        analysis.topTokens.forEach(([token, count], index) => {
            const percentage = ((count / analysis.topTokens.reduce((sum, [, c]) => sum + c, 0)) * 100).toFixed(1);
            const paddedIndex = (index + 1).toString().padStart(2);
            const paddedToken = token.padEnd(20);
            const paddedCount = count.toString().padStart(4);
            const paddedPercentage = `${percentage}%`.padStart(6);
            resultContent += `${paddedIndex}. ${paddedToken} ${paddedCount} occurrences (${paddedPercentage})\n`;
        });
        resultContent += "\n💡 These are good candidates for renaming operations.";
        showBox("Analysis Complete", resultContent);
    }
    catch (error) {
        s.stop();
        showError(`Analysis failed: ${error.message || error}`);
        process.exit(1);
    }
}
async function interactiveMode() {
    showScriptBox("safe-rename --interactive", "Launches interactive CLI wizard for safe rename operations.\n" +
        "Choose operation type and follow guided prompts for renaming.");
    showConfirmBox("Start interactive mode?");
    try {
        // Load configuration
        const config = await loadConfig(process.cwd());
        // Get operation type
        const operation = await select({
            message: "What would you like to do?",
            options: [
                { value: "single", label: "🔄 Single rename operation" },
                { value: "multi", label: "📦 Multi-map batch rename" },
                { value: "analyze", label: "🔍 Analyze repository for suggestions" },
                { value: "config", label: "⚙️ View/edit configuration" }
            ]
        });
        if (operation === "analyze") {
            await analyzeRepository();
            return;
        }
        if (operation === "config") {
            await showConfig();
            return;
        }
        if (operation === "single") {
            await handleSingleRename(config);
        }
        else if (operation === "multi") {
            await handleMultiRename(config);
        }
    }
    catch (error) {
        if (error instanceof Error && error.message.includes("cancel")) {
            showError("Operation cancelled by user");
            process.exit(0);
        }
        showError("Interactive mode failed");
        process.exit(1);
    }
}
async function handleSingleRename(config) {
    const oldName = await text({
        message: "Enter the old name to rename:",
        placeholder: "old-package",
        validate: (value) => {
            if (!value || !value.trim())
                return "Old name is required";
            if (value.length > 255)
                return "Name must be less than 255 characters";
            if (!/^[a-zA-Z0-9\-_/@]+$/.test(value))
                return "Name contains invalid characters";
        }
    });
    const newName = await text({
        message: "Enter the new name:",
        placeholder: "new-package",
        validate: (value) => {
            if (!value || !value.trim())
                return "New name is required";
            if (value === oldName)
                return "New name must be different from old name";
            if (value.length > 255)
                return "Name must be less than 255 characters";
            if (!/^[a-zA-Z0-9\-_/@]+$/.test(value))
                return "Name contains invalid characters";
        }
    });
    // Configure options
    const options = await multiselect({
        message: "Select rename options:",
        options: [
            { value: "dry", label: "Dry run (preview only)" },
            { value: "updatePackage", label: "Update package.json dependencies" },
            { value: "updateRemote", label: "Update git remotes" },
            { value: "caseSensitive", label: "Case-sensitive rename" }
        ],
        initialValues: [
            config.dry ? "dry" : undefined,
            config.updatePackage ? "updatePackage" : undefined,
            config.updateRemote ? "updateRemote" : undefined,
            config.caseSensitive ? "caseSensitive" : undefined
        ].filter(Boolean)
    });
    const concurrency = await text({
        message: "Number of concurrent files to process:",
        placeholder: config.concurrency.toString(),
        validate: (value) => {
            if (!value)
                return "Concurrency is required";
            const num = parseInt(value);
            if (isNaN(num) || num < 1 || num > 100)
                return "Must be between 1 and 100";
        }
    });
    // Confirmation
    const confirmed = await confirm({
        message: `Ready to rename "${String(oldName)}" to "${String(newName)}"?`
    });
    if (!confirmed) {
        cancel("Operation cancelled");
        process.exit(0);
    }
    // Execute
    const ctx = {
        cwd: process.cwd(),
        args: {
            "old-name": oldName,
            "new-name": newName,
            "dry": Array.isArray(options) && options.includes("dry"),
            "update-package": Array.isArray(options) && options.includes("updatePackage"),
            "update-remote": Array.isArray(options) && options.includes("updateRemote"),
            "case-sensitive": Array.isArray(options) && options.includes("caseSensitive"),
            "concurrency": concurrency
        }
    };
    await runSafeRename(ctx);
    outro("✅ Rename operation completed successfully!");
}
async function handleMultiRename(config) {
    note("Multi-map format: {\"old1\": \"new1\", \"old2\": \"new2\"}", "Multi-Map Rename");
    const multiMapText = await text({
        message: "Enter multi-map JSON:",
        placeholder: '{"pkg1": "newpkg1", "pkg2": "newpkg2"}',
        validate: (value) => {
            if (!value || !value.trim())
                return "Multi-map is required";
            try {
                const parsed = JSON.parse(value);
                if (typeof parsed !== "object" || Array.isArray(parsed)) {
                    return "Multi-map must be a valid JSON object";
                }
                return undefined;
            }
            catch {
                return "Invalid JSON format";
            }
        }
    });
    const multiMap = JSON.parse(String(multiMapText));
    // Configure options
    const options = await multiselect({
        message: "Select rename options:",
        options: [
            { value: "dry", label: "Dry run (preview only)" },
            { value: "updatePackage", label: "Update package.json dependencies" },
            { value: "updateRemote", label: "Update git remotes" },
            { value: "caseSensitive", label: "Case-sensitive rename" }
        ],
        initialValues: [
            config.dry ? "dry" : undefined,
            config.updatePackage ? "updatePackage" : undefined,
            config.updateRemote ? "updateRemote" : undefined,
            config.caseSensitive ? "caseSensitive" : undefined
        ].filter(Boolean)
    });
    const concurrency = await text({
        message: "Number of concurrent files to process:",
        placeholder: config.concurrency.toString(),
        validate: (value) => {
            if (!value)
                return "Concurrency is required";
            const num = parseInt(value);
            if (isNaN(num) || num < 1 || num > 100)
                return "Must be between 1 and 100";
        }
    });
    // Get first old/new name for validation
    const firstOld = Object.keys(multiMap)[0];
    const firstNew = multiMap[firstOld];
    // Confirmation
    const confirmed = await confirm({
        message: `Ready to rename ${Object.keys(multiMap).length} items?`
    });
    if (!confirmed) {
        cancel("Operation cancelled");
        process.exit(0);
    }
    // Execute
    const ctx = {
        cwd: process.cwd(),
        args: {
            "old-name": firstOld,
            "new-name": firstNew,
            "multi-map": JSON.stringify(multiMap),
            "dry": Array.isArray(options) && options.includes("dry"),
            "update-package": Array.isArray(options) && options.includes("updatePackage"),
            "update-remote": Array.isArray(options) && options.includes("updateRemote"),
            "case-sensitive": Array.isArray(options) && options.includes("caseSensitive"),
            "concurrency": concurrency
        }
    };
    await runSafeRename(ctx);
    outro("✅ Multi-rename operation completed successfully!");
}
// Main execution
async function main() {
    try {
        if (args.help) {
            showHelp();
            return;
        }
        if (args.version) {
            showVersion();
            return;
        }
        if (args["show-config"]) {
            await showConfig();
            return;
        }
        if (args.analyze) {
            await analyzeRepository();
            return;
        }
        if (args.interactive) {
            await interactiveMode();
            return;
        }
        // Validate required arguments
        if (!args["old-name"] || !args["new-name"]) {
            console.error("❌ --old-name and --new-name are required. Use --help for usage information.");
            process.exit(1);
        }
        // Validate inputs
        const validation = validateRenameOptions(args["old-name"], args["new-name"]);
        if (!validation.isValid) {
            console.error("❌ Validation failed:");
            console.error(formatValidationErrors(validation.errors));
            process.exit(1);
        }
        // Validate multi-map if provided
        if (args["multi-map"]) {
            try {
                const parsed = JSON.parse(args["multi-map"]);
                const multiValidation = validateMultiMap(parsed);
                if (!multiValidation.isValid) {
                    console.error("❌ Multi-map validation failed:");
                    console.error(formatValidationErrors(multiValidation.errors));
                    process.exit(1);
                }
            }
            catch (error) {
                console.error("❌ Invalid JSON in multi-map:", error);
                process.exit(1);
            }
        }
        // Show banner for non-interactive mode
        if (!args.quiet) {
            showScriptBox("safe-rename --old-name <old> --new-name <new>", `Enterprise-grade repository refactoring tool.\n\n` +
                `Renames "${args["old-name"]}" → "${args["new-name"]}" across all files.\n` +
                `Supports TypeScript, JavaScript, JSON, YAML, ENV, Docker, Markdown.\n` +
                `Safe operations with dry-run mode and validation.`);
            if (args.dry) {
                showProgress("DRY RUN MODE", "No files will be modified - preview only");
            }
            console.log("─".repeat(60));
        }
        // Execute rename
        await runSafeRename({ cwd: process.cwd(), args });
        if (!args.quiet) {
            showSuccess("Rename operation completed successfully!");
        }
    }
    catch (error) {
        console.error("❌ safe-rename failed:", error);
        process.exit(1);
    }
}
main();
