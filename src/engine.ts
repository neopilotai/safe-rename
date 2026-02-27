import fg from "fast-glob";
import fs from "fs-extra";
import path from "path";
import { parse as parseYaml } from "yaml";
import pLimit from "p-limit";
import { loadConfig, mergeConfigWithArgs, SafeRenameConfig } from "./config";

interface RenameOptions {
  oldName: string;
  newName: string;
  updatePackage?: boolean;
  updateRemote?: boolean;
  dry?: boolean;
  multiMap?: Record<string, string>;
  caseSensitive?: boolean;
  ignore?: string[];
  include?: string[];
  concurrency?: number;
}

interface SafeRenameContext {
  cwd: string;
  args: any;
}

export async function runSafeRename(ctx: SafeRenameContext) {
  const { cwd, args } = ctx;

  // Load configuration
  const config = await loadConfig(cwd);
  const mergedConfig = mergeConfigWithArgs(config, args);

  const options: RenameOptions = {
    oldName: args["old-name"] || args.oldName,
    newName: args["new-name"] || args.newName,
    updatePackage: mergedConfig.updatePackage,
    updateRemote: mergedConfig.updateRemote,
    dry: mergedConfig.dry,
    multiMap: mergedConfig.multiMap,
    caseSensitive: mergedConfig.caseSensitive,
    ignore: mergedConfig.ignore,
    include: mergedConfig.include,
    concurrency: mergedConfig.concurrency,
  };

  if (!options.oldName || !options.newName) {
    console.error("❌ --old-name and --new-name are required");
    process.exit(1);
  }

  console.log(
    `🔄 Starting safe rename: ${options.oldName} → ${options.newName}`,
  );
  if (options.dry) console.log("🔍 DRY RUN MODE - no files will be modified");

  const files = await findFilesToProcess(cwd, options);
  console.log(`📁 Found ${files.length} files to process`);

  const limit = pLimit(options.concurrency || 10);
  const results = await Promise.all(
    files.map((file: string) => limit(() => processFile(file, options))),
  );

  const summary = results.reduce(
    (acc: any, result: any) => ({
      processed: acc.processed + (result.processed ? 1 : 0),
      modified: acc.modified + (result.modified ? 1 : 0),
      errors: acc.errors + (result.error ? 1 : 0),
    }),
    { processed: 0, modified: 0, errors: 0 },
  );

  console.log(
    `✅ Summary: ${summary.processed} processed, ${summary.modified} modified, ${summary.errors} errors`,
  );

  if (options.updatePackage && !options.dry) {
    await updatePackageJson(cwd, options);
  }

  if (options.updateRemote && !options.dry) {
    await updateGitRemote(cwd, options);
  }
}

async function findFilesToProcess(
  root: string,
  options: RenameOptions,
): Promise<string[]> {
  const patterns = options.include || [
    "**/*.{ts,tsx,js,jsx}",
    "**/*.{json,yml,yaml}",
    "**/*.env*",
    "**/Dockerfile*",
    "**/docker-compose*",
    "**/*.md",
  ];

  const ignore = options.ignore || [
    "node_modules/**",
    "dist/**",
    "build/**",
    ".git/**",
    "**/coverage/**",
  ];

  const files = await fg(patterns, {
    cwd: root,
    ignore,
  });

  return files.map((file) => path.join(root, file));
}

async function processFile(filePath: string, options: RenameOptions) {
  try {
    const ext = path.extname(filePath);
    const content = await fs.readFile(filePath, "utf8");
    let modified = false;
    let newContent = content;

    if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
      newContent = processTypeScriptFile(content, options);
    } else if ([".json"].includes(ext)) {
      newContent = processJsonFile(content, options);
    } else if ([".yml", ".yaml"].includes(ext)) {
      newContent = processYamlFile(content, options);
    } else if (filePath.includes("env")) {
      newContent = processEnvFile(content, options);
    } else if (
      filePath.includes("Dockerfile") ||
      filePath.includes("docker-compose")
    ) {
      newContent = processDockerFile(content, options);
    } else if ([".md"].includes(ext)) {
      newContent = processMarkdownFile(content, options);
    }

    modified = newContent !== content;

    if (modified && !options.dry) {
      await fs.writeFile(filePath, newContent, "utf8");
    }

    return { processed: true, modified, error: null };
  } catch (error: any) {
    return { processed: false, modified: false, error: error.message };
  }
}

function processTypeScriptFile(
  content: string,
  options: RenameOptions,
): string {
  let newContent = content;
  const renameMap = options.multiMap || { [options.oldName]: options.newName };

  for (const [oldName, newName] of Object.entries(renameMap)) {
    const flags = options.caseSensitive ? "g" : "gi";

    newContent = newContent.replace(
      new RegExp(
        `(import\\s+.*?\\s+from\\s+['"][^'"]*)${oldName}([^'"]*['"])`,
        flags,
      ),
      `$1${newName}$2`,
    );

    newContent = newContent.replace(
      new RegExp(
        `(export\\s+.*?\\s+from\\s+['"][^'"]*)${oldName}([^'"]*['"])`,
        flags,
      ),
      `$1${newName}$2`,
    );

    newContent = newContent.replace(
      new RegExp(`(require\\s*\\(\\s*['"][^'"]*)${oldName}([^'"]*['"])`, flags),
      `$1${newName}$2`,
    );

    newContent = newContent.replace(
      new RegExp(`(@${oldName})`, flags),
      `@${newName}`,
    );

    newContent = newContent.replace(
      new RegExp(`\\b${oldName}\\b`, flags),
      newName,
    );
  }

  return newContent;
}

function processJsonFile(content: string, options: RenameOptions): string {
  try {
    const data = JSON.parse(content);
    const renameMap = options.multiMap || {
      [options.oldName]: options.newName,
    };

    function processValue(value: any): any {
      if (typeof value === "string") {
        let newValue = value;
        for (const [oldName, newName] of Object.entries(renameMap)) {
          const flags = options.caseSensitive ? "g" : "gi";
          newValue = newValue.replace(new RegExp(oldName, flags), newName);
        }
        return newValue;
      } else if (Array.isArray(value)) {
        return value.map(processValue);
      } else if (typeof value === "object" && value !== null) {
        const result: any = {};
        for (const [key, val] of Object.entries(value)) {
          let newKey = key;
          for (const [oldName, newName] of Object.entries(renameMap)) {
            const flags = options.caseSensitive ? "g" : "gi";
            newKey = newKey.replace(new RegExp(oldName, flags), newName);
          }
          result[newKey] = processValue(val);
        }
        return result;
      }
      return value;
    }

    const processedData = processValue(data);
    return JSON.stringify(processedData, null, 2);
  } catch (error: any) {
    console.warn(
      `⚠️  Failed to parse JSON file, treating as plain text: ${error.message}`,
    );
    return content;
  }
}

function processYamlFile(content: string, options: RenameOptions): string {
  try {
    const data = parseYaml(content);
    const renameMap = options.multiMap || {
      [options.oldName]: options.newName,
    };

    function processValue(value: any): any {
      if (typeof value === "string") {
        let newValue = value;
        for (const [oldName, newName] of Object.entries(renameMap)) {
          const flags = options.caseSensitive ? "g" : "gi";
          newValue = newValue.replace(new RegExp(oldName, flags), newName);
        }
        return newValue;
      } else if (Array.isArray(value)) {
        return value.map(processValue);
      } else if (typeof value === "object" && value !== null) {
        const result: any = {};
        for (const [key, val] of Object.entries(value)) {
          let newKey = key;
          for (const [oldName, newName] of Object.entries(renameMap)) {
            const flags = options.caseSensitive ? "g" : "gi";
            newKey = newKey.replace(new RegExp(oldName, flags), newName);
          }
          result[newKey] = processValue(val);
        }
        return result;
      }
      return value;
    }

    const processedData = processValue(data);
    const yamlString = require("yaml").stringify(processedData);
    return yamlString;
  } catch (error: any) {
    console.warn(
      `⚠️  Failed to parse YAML file, treating as plain text: ${error.message}`,
    );
    return content;
  }
}

function processEnvFile(content: string, options: RenameOptions): string {
  let newContent = content;
  const renameMap = options.multiMap || { [options.oldName]: options.newName };

  for (const [oldName, newName] of Object.entries(renameMap)) {
    const flags = options.caseSensitive ? "g" : "gi";

    newContent = newContent.replace(
      new RegExp(`(${oldName.toUpperCase()})`, flags),
      newName.toUpperCase(),
    );

    newContent = newContent.replace(
      new RegExp(`=${oldName}`, flags),
      `=${newName}`,
    );
  }

  return newContent;
}

function processDockerFile(content: string, options: RenameOptions): string {
  let newContent = content;
  const renameMap = options.multiMap || { [options.oldName]: options.newName };

  for (const [oldName, newName] of Object.entries(renameMap)) {
    const flags = options.caseSensitive ? "g" : "gi";

    const fromRegex = new RegExp(
      `(FROM|image:)\\s*([^\\s]*${oldName}[^\\s]*)`,
      flags,
    );
    newContent = newContent.replace(fromRegex, (match, prefix, imagePath) => {
      const newImagePath = imagePath.replace(
        new RegExp(oldName, flags),
        newName,
      );
      return `${prefix} ${newImagePath}`;
    });

    newContent = newContent.replace(
      new RegExp(`(ENV|ARG)\\s+(${oldName.toUpperCase()})`, flags),
      `$1 ${newName.toUpperCase()}`,
    );
  }

  return newContent;
}

function processMarkdownFile(content: string, options: RenameOptions): string {
  let newContent = content;
  const renameMap = options.multiMap || { [options.oldName]: options.newName };

  for (const [oldName, newName] of Object.entries(renameMap)) {
    const flags = options.caseSensitive ? "g" : "gi";

    const codeBlockRegex = new RegExp(
      "(\\\\`\\\\`\\\\[\\\\s\\\\S]*?\\\\`\\\\`\\\\`|\\\\`[^\\\\`]*\\\\`)",
      flags,
    );
    newContent = newContent.replace(codeBlockRegex, (match) =>
      match.replace(new RegExp(oldName, flags), newName),
    );

    const linkRegex = new RegExp(
      "\\[([^\\]]*)\\]\\(([^)]*" + oldName + "[^)]*)\\)",
      flags,
    );
    newContent = newContent.replace(
      linkRegex,
      (match, text: string, url: string) =>
        "[" +
        text +
        "](" +
        url.replace(new RegExp(oldName, flags), newName) +
        ")",
    );

    newContent = newContent.replace(
      new RegExp("\\b" + oldName + "\\b", flags),
      newName,
    );
  }

  return newContent;
}

async function updatePackageJson(root: string, options: RenameOptions) {
  const packageJsonPath = path.join(root, "package.json");

  if (await fs.pathExists(packageJsonPath)) {
    const packageJson = await fs.readJson(packageJsonPath);

    if (packageJson.name === options.oldName) {
      packageJson.name = options.newName;
    }

    ["dependencies", "devDependencies", "peerDependencies"].forEach(
      (depType) => {
        if (packageJson[depType]) {
          const renameMap = options.multiMap || {
            [options.oldName]: options.newName,
          };
          for (const [oldName, newName] of Object.entries(renameMap)) {
            const oldDepKey = Object.keys(packageJson[depType]).find((key) =>
              key.includes(oldName),
            );
            if (oldDepKey) {
              const newDepKey = oldDepKey.replace(
                new RegExp(oldName, options.caseSensitive ? "g" : "gi"),
                newName,
              );
              packageJson[depType][newDepKey] = packageJson[depType][oldDepKey];
              delete packageJson[depType][oldDepKey];
            }
          }
        }
      },
    );

    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
    console.log("✅ Updated package.json");
  }
}

async function updateGitRemote(root: string, options: RenameOptions) {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  try {
    const { stdout } = await execAsync("git remote -v", { cwd: root });
    const renameMap = options.multiMap || {
      [options.oldName]: options.newName,
    };

    for (const [oldName, newName] of Object.entries(renameMap)) {
      const remoteRegex = new RegExp(
        `(origin\\s +.*? ${oldName}.*?) \\s +\\(fetch\\)`,
        "gi",
      );
      const match = stdout.match(remoteRegex);

      if (match) {
        const oldUrl = match[0].replace(" (fetch)", "").replace("origin\t", "");
        const newUrl = oldUrl.replace(
          new RegExp(oldName, options.caseSensitive ? "g" : "gi"),
          newName,
        );

        await execAsync(`git remote set - url origin ${newUrl} `, {
          cwd: root,
        });
        console.log(`✅ Updated git remote: ${oldUrl} → ${newUrl} `);
      }
    }
  } catch (error: any) {
    console.warn(`⚠️  Failed to update git remote: ${error.message} `);
  }
}

// Export processing functions for testing
export {
  processTypeScriptFile,
  processJsonFile,
  processYamlFile,
  processEnvFile,
  processDockerFile,
  processMarkdownFile,
  updatePackageJson,
  updateGitRemote,
};
