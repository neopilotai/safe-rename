import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs-extra";
import path from "path";
const execAsync = promisify(exec);
describe("CLI Integration Tests", () => {
    const testDir = "/tmp/safe-rename-cli-test";
    const cliPath = path.join(process.cwd(), "bin/safe-rename.ts");
    beforeEach(async () => {
        await fs.ensureDir(testDir);
        // Create test files
        await fs.writeFile(path.join(testDir, "index.ts"), "import { a } from 'old-package';");
        await fs.writeFile(path.join(testDir, "config.json"), '{"old-package": "value"}');
        await fs.writeFile(path.join(testDir, ".env"), 'OLD_VAR=value');
        await fs.writeJson(path.join(testDir, "package.json"), {
            name: "test-project",
            dependencies: { "old-package": "^1.0.0" }
        });
    });
    afterEach(async () => {
        await fs.remove(testDir);
    });
    describe("CLI Basic Functionality", () => {
        test("should show help when no arguments provided", async () => {
            try {
                await execAsync(`bunx ${cliPath}`, { cwd: testDir });
                // If we reach here, the test should fail
                expect(true).toBe(false);
            }
            catch (error) {
                expect(error.message).toContain("--old-name and --new-name are required");
            }
        });
        test("should perform dry run rename", async () => {
            const { stdout } = await execAsync(`bunx ${cliPath} --old-name old-package --new-name new-package --dry`, { cwd: testDir });
            expect(stdout).toContain("DRY RUN MODE");
            expect(stdout).toContain("old-package → new-package");
            expect(stdout).toContain("processed");
        });
        test("should update package.json when requested", async () => {
            const { stdout } = await execAsync(`bunx ${cliPath} --old-name old-package --new-name new-package --update-package --dry`, { cwd: testDir });
            expect(stdout).toContain("DRY RUN MODE");
            // In dry run, package.json shouldn't actually be updated
            const packageJson = await fs.readJson(path.join(testDir, "package.json"));
            expect(packageJson.dependencies).toHaveProperty("old-package");
        });
        test("should handle case sensitive option", async () => {
            await fs.writeFile(path.join(testDir, "case.ts"), "const OldPackage = 'test';");
            const { stdout } = await execAsync(`bunx ${cliPath} --old-name OldPackage --new-name NewPackage --case-sensitive --dry`, { cwd: testDir });
            expect(stdout).toContain("DRY RUN MODE");
            expect(stdout).toContain("OldPackage → NewPackage");
        });
        test("should handle multi-map renames", async () => {
            const multiMap = JSON.stringify({ "pkg1": "newpkg1", "pkg2": "newpkg2" });
            await fs.writeFile(path.join(testDir, "multi.ts"), `
        import { a } from 'pkg1';
        import { b } from 'pkg2';
      `);
            const { stdout } = await execAsync(`bunx ${cliPath} --old-name pkg1 --new-name newpkg1 --multi-map '${multiMap}' --dry`, { cwd: testDir });
            expect(stdout).toContain("DRY RUN MODE");
            expect(stdout).toContain("processed");
        });
    });
    describe("CLI Error Handling", () => {
        test("should handle invalid old name", async () => {
            try {
                await execAsync(`bunx ${cliPath} --old-name '' --new-name new-package --dry`, { cwd: testDir });
                // If we reach here, the test should fail
                expect(true).toBe(false);
            }
            catch (error) {
                expect(error.message).toContain("required");
            }
        });
        test("should handle invalid new name", async () => {
            try {
                await execAsync(`bunx ${cliPath} --old-name old-package --new-name '' --dry`, { cwd: testDir });
                // If we reach here, the test should fail
                expect(true).toBe(false);
            }
            catch (error) {
                expect(error.message).toContain("required");
            }
        });
        test("should handle same old and new names", async () => {
            try {
                await execAsync(`bunx ${cliPath} --old-name same --new-name same --dry`, { cwd: testDir });
                // If we reach here, the test should fail
                expect(true).toBe(false);
            }
            catch (error) {
                expect(error.message).toContain("different");
            }
        });
        test("should handle non-existent directory", async () => {
            const nonExistentDir = "/tmp/non-existent-dir";
            try {
                await execAsync(`bunx ${cliPath} --old-name old --new-name new --dry`, { cwd: nonExistentDir });
                // If we reach here, the test should fail
                expect(true).toBe(false);
            }
            catch (error) {
                expect(error.message).toContain("ENOENT");
            }
        });
    });
    describe("CLI Configuration Integration", () => {
        test("should load configuration from .saferenamerc.json", async () => {
            const config = {
                updatePackage: true,
                caseSensitive: true,
                dry: true,
                concurrency: 5
            };
            await fs.writeJson(path.join(testDir, ".saferenamerc.json"), config);
            const { stdout } = await execAsync(`bunx ${cliPath} --old-name old-package --new-name new-package`, { cwd: testDir });
            expect(stdout).toContain("DRY RUN MODE");
            expect(stdout).toContain("processed");
        });
        test("should merge CLI args with config file", async () => {
            const config = {
                updatePackage: false,
                caseSensitive: false,
                dry: true,
                concurrency: 10
            };
            await fs.writeJson(path.join(testDir, ".saferenamerc.json"), config);
            const { stdout } = await execAsync(`bunx ${cliPath} --old-name old-package --new-name new-package --update-package`, { cwd: testDir });
            expect(stdout).toContain("DRY RUN MODE");
            expect(stdout).toContain("processed");
        });
    });
    describe("CLI Performance Tests", () => {
        test("should handle large number of files", async () => {
            // Create 100 test files
            const filePromises = [];
            for (let i = 0; i < 100; i++) {
                filePromises.push(fs.writeFile(path.join(testDir, `file${i}.ts`), `import { a } from 'old-package-${i}';`));
            }
            await Promise.all(filePromises);
            const startTime = Date.now();
            const { stdout } = await execAsync(`bunx ${cliPath} --old-name old-package-1 --new-name new-package-1 --dry`, { cwd: testDir });
            const endTime = Date.now();
            expect(stdout).toContain("DRY RUN MODE");
            expect(stdout).toContain("processed");
            expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
        });
        test("should handle large file content", async () => {
            // Create a file with many imports
            let content = "";
            for (let i = 0; i < 1000; i++) {
                content += `import { a${i} } from 'old-package-${i}';\n`;
            }
            await fs.writeFile(path.join(testDir, "large.ts"), content);
            const startTime = Date.now();
            const { stdout } = await execAsync(`bunx ${cliPath} --old-name old-package-1 --new-name new-package-1 --dry`, { cwd: testDir });
            const endTime = Date.now();
            expect(stdout).toContain("DRY RUN MODE");
            expect(stdout).toContain("processed");
            expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
        });
    });
    describe("CLI Real Operations", () => {
        test("should actually rename files when not in dry mode", async () => {
            const originalContent = "import { a } from 'old-package';";
            await fs.writeFile(path.join(testDir, "real.ts"), originalContent);
            await execAsync(`bunx ${cliPath} --old-name old-package --new-name new-package`, { cwd: testDir });
            const updatedContent = await fs.readFile(path.join(testDir, "real.ts"), "utf8");
            expect(updatedContent).toContain("new-package");
            expect(updatedContent).not.toContain("old-package");
        });
        test("should update package.json when not in dry mode", async () => {
            await execAsync(`bunx ${cliPath} --old-name old-package --new-name new-package --update-package`, { cwd: testDir });
            const packageJson = await fs.readJson(path.join(testDir, "package.json"));
            expect(packageJson.dependencies).toHaveProperty("new-package");
            expect(packageJson.dependencies).not.toHaveProperty("old-package");
        });
    });
});
