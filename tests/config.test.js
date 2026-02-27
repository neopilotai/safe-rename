import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { loadConfig, mergeConfigWithArgs, getDefaultConfig } from "../src/config";
import fs from "fs-extra";
import path from "path";
describe("Config Module Tests", () => {
    const testDir = "/tmp/safe-rename-test";
    beforeEach(async () => {
        await fs.ensureDir(testDir);
    });
    afterEach(async () => {
        await fs.remove(testDir);
    });
    describe("loadConfig", () => {
        test("should return default config when no config file exists", async () => {
            const config = await loadConfig(testDir);
            expect(config).toEqual(getDefaultConfig());
        });
        test("should load .saferenamerc.json config", async () => {
            const customConfig = {
                updatePackage: true,
                updateRemote: false,
                caseSensitive: true,
                dry: true,
                concurrency: 5
            };
            await fs.writeJson(path.join(testDir, ".saferenamerc.json"), customConfig);
            const config = await loadConfig(testDir);
            expect(config.updatePackage).toBe(true);
            expect(config.updateRemote).toBe(false);
            expect(config.caseSensitive).toBe(true);
            expect(config.dry).toBe(true);
            expect(config.concurrency).toBe(5);
        });
        test("should load config from package.json safeRename field", async () => {
            const packageJson = {
                name: "test-project",
                safeRename: {
                    updatePackage: false,
                    concurrency: 20
                }
            };
            await fs.writeJson(path.join(testDir, "package.json"), packageJson);
            const config = await loadConfig(testDir);
            expect(config.updatePackage).toBe(false);
            expect(config.concurrency).toBe(20);
        });
        test("should prioritize .saferenamerc.json over package.json", async () => {
            const packageJson = {
                name: "test-project",
                safeRename: {
                    updatePackage: false,
                    concurrency: 20
                }
            };
            const customConfig = {
                updatePackage: true,
                concurrency: 10
            };
            await fs.writeJson(path.join(testDir, "package.json"), packageJson);
            await fs.writeJson(path.join(testDir, ".saferenamerc.json"), customConfig);
            const config = await loadConfig(testDir);
            expect(config.updatePackage).toBe(true);
            expect(config.concurrency).toBe(10);
        });
        test("should handle malformed config files gracefully", async () => {
            await fs.writeFile(path.join(testDir, ".saferenamerc.json"), "invalid json");
            const config = await loadConfig(testDir);
            expect(config).toEqual(getDefaultConfig());
        });
    });
    describe("mergeConfigWithArgs", () => {
        test("should merge CLI args with config", () => {
            const config = {
                updatePackage: false,
                updateRemote: false,
                caseSensitive: false,
                dry: true,
                concurrency: 10
            };
            const args = {
                "update-package": true,
                "update-remote": true,
                dry: false,
                concurrency: 20
            };
            const merged = mergeConfigWithArgs(config, args);
            expect(merged.updatePackage).toBe(true);
            expect(merged.updateRemote).toBe(true);
            expect(merged.caseSensitive).toBe(false);
            expect(merged.dry).toBe(false);
            expect(merged.concurrency).toBe(20);
        });
        test("should use config values when CLI args not provided", () => {
            const config = {
                updatePackage: false,
                updateRemote: true,
                caseSensitive: true,
                dry: false,
                concurrency: 15
            };
            const args = {};
            const merged = mergeConfigWithArgs(config, args);
            expect(merged.updatePackage).toBe(false);
            expect(merged.updateRemote).toBe(true);
            expect(merged.caseSensitive).toBe(true);
            expect(merged.dry).toBe(false);
            expect(merged.concurrency).toBe(15);
        });
        test("should parse multi-map from CLI args", () => {
            const config = { multiMap: { "old": "new" } };
            const args = { "multi-map": '{"pkg1": "newpkg1", "pkg2": "newpkg2"}' };
            const merged = mergeConfigWithArgs(config, args);
            expect(merged.multiMap).toEqual({
                "pkg1": "newpkg1",
                "pkg2": "newpkg2"
            });
        });
    });
    describe("getDefaultConfig", () => {
        test("should return expected default values", () => {
            const config = getDefaultConfig();
            expect(config.updatePackage).toBe(false);
            expect(config.updateRemote).toBe(false);
            expect(config.caseSensitive).toBe(false);
            expect(config.dry).toBe(false);
            expect(config.concurrency).toBe(10);
            expect(Array.isArray(config.ignore)).toBe(true);
            expect(Array.isArray(config.include)).toBe(true);
            expect(config.ignore).toContain("node_modules/**");
            expect(config.include).toContain("**/*.{ts,tsx,js,jsx}");
        });
    });
});
