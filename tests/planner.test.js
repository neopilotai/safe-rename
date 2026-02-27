import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { analyzeRepo } from "../src/planner";
import fs from "fs-extra";
import path from "path";
describe("Planner Module Tests", () => {
    const testDir = "/tmp/safe-rename-planner-test";
    beforeEach(async () => {
        await fs.ensureDir(testDir);
    });
    afterEach(async () => {
        await fs.remove(testDir);
    });
    describe("analyzeRepo", () => {
        test("should analyze empty repository", async () => {
            const analysis = await analyzeRepo(testDir);
            expect(analysis).toHaveProperty("topTokens");
            expect(Array.isArray(analysis.topTokens)).toBe(true);
        });
        test("should detect TypeScript imports", async () => {
            const tsFile = `
        import { something } from 'frequent-package';
        import other from 'another-package';
        const pkg = require('require-package');
      `;
            await fs.writeFile(path.join(testDir, "index.ts"), tsFile);
            const analysis = await analyzeRepo(testDir);
            expect(analysis.topTokens.length).toBeGreaterThan(0);
        });
        test("should detect JSON package references", async () => {
            const packageJson = {
                name: "test-project",
                dependencies: {
                    "frequent-dep": "^1.0.0",
                    "another-dep": "^2.0.0"
                },
                scripts: {
                    "build": "frequent-dep build",
                    "test": "another-dep test"
                }
            };
            await fs.writeJson(path.join(testDir, "package.json"), packageJson);
            const analysis = await analyzeRepo(testDir);
            expect(analysis.topTokens.some(([token]) => token.includes("frequent-dep"))).toBe(true);
            expect(analysis.topTokens.some(([token]) => token.includes("another-dep"))).toBe(true);
        });
        test("should detect environment variables", async () => {
            const envFile = `
        FREQUENT_VAR=value
        ANOTHER_VAR=another_value
        RARE_VAR=rare
      `;
            await fs.writeFile(path.join(testDir, ".env"), envFile);
            const analysis = await analyzeRepo(testDir);
            expect(analysis.topTokens.some(([token]) => token.includes("FREQUENT_VAR"))).toBe(true);
            expect(analysis.topTokens.some(([token]) => token.includes("ANOTHER_VAR"))).toBe(true);
            expect(analysis.topTokens.some(([token]) => token.includes("RARE_VAR"))).toBe(true);
        });
        test("should detect Docker images", async () => {
            const dockerfile = `
        FROM frequent-image:latest
        FROM another-image:tag
        COPY . .
        RUN frequent-image --version
      `;
            await fs.writeFile(path.join(testDir, "Dockerfile"), dockerfile);
            const analysis = await analyzeRepo(testDir);
            expect(analysis.topTokens.some(([token]) => token.includes("frequent-image"))).toBe(true);
            expect(analysis.topTokens.some(([token]) => token.includes("another-image"))).toBe(true);
        });
        test("should detect YAML configurations", async () => {
            const yamlFile = `
        services:
          frequent-service:
            image: frequent-image
          another-service:
            image: another-image
        environment:
          FREQUENT_VAR: value
      `;
            await fs.writeFile(path.join(testDir, "docker-compose.yml"), yamlFile);
            const analysis = await analyzeRepo(testDir);
            expect(analysis.topTokens.some(([token]) => token.includes("frequent-service"))).toBe(true);
            expect(analysis.topTokens.some(([token]) => token.includes("another-service"))).toBe(true);
        });
        test("should count token frequency correctly", async () => {
            const files = [
                "import { a } from 'frequent-token';",
                "import { b } from 'frequent-token';",
                "import { c } from 'frequent-token';",
                "import { d } from 'rare-token';"
            ];
            await Promise.all(files.map((content, index) => fs.writeFile(path.join(testDir, `file${index}.ts`), content)));
            const analysis = await analyzeRepo(testDir);
            const frequentToken = analysis.topTokens.find(([token]) => token === "frequent-token");
            const rareToken = analysis.topTokens.find(([token]) => token === "rare-token");
            expect(frequentToken).toBeDefined();
            expect(frequentToken[1]).toBe(3); // Should appear 3 times
            expect(rareToken).toBeDefined();
            expect(rareToken[1]).toBe(1); // Should appear 1 time
        });
        test("should handle multiple file types", async () => {
            await fs.writeFile(path.join(testDir, "app.ts"), "import 'frequent-pkg';");
            await fs.writeJson(path.join(testDir, "config.json"), { "frequent-key": "value" });
            await fs.writeFile(path.join(testDir, ".env"), "FREQUENT_VAR=value");
            await fs.writeFile(path.join(testDir, "Dockerfile"), "FROM frequent-image");
            const analysis = await analyzeRepo(testDir);
            expect(analysis.topTokens.length).toBeGreaterThan(0);
            expect(analysis.topTokens.some(([token]) => token.includes("FREQUENT_VAR"))).toBe(true);
            expect(analysis.topTokens.some(([token]) => token.includes("frequent-image"))).toBe(true);
        });
        test("should ignore node_modules directory", async () => {
            await fs.ensureDir(path.join(testDir, "node_modules"));
            await fs.writeFile(path.join(testDir, "node_modules", "index.ts"), "import 'should-be-ignored';");
            await fs.writeFile(path.join(testDir, "src", "index.ts"), "import 'should-be-found';");
            const analysis = await analyzeRepo(testDir);
            expect(analysis.topTokens.some(([token]) => token.includes("should-be-found"))).toBe(true);
            expect(analysis.topTokens.some(([token]) => token.includes("should-be-ignored"))).toBe(false);
        });
        test("should handle read errors gracefully", async () => {
            const unreadableFile = path.join(testDir, "unreadable.ts");
            await fs.writeFile(unreadableFile, "import 'test';");
            await fs.chmod(unreadableFile, 0o000); // Make unreadable
            const analysis = await analyzeRepo(testDir);
            expect(analysis).toBeDefined();
            expect(Array.isArray(analysis.topTokens)).toBe(true);
        });
        test("should prioritize frequently occurring tokens", async () => {
            const tokens = ["common", "uncommon", "rare"];
            const frequencies = [10, 3, 1];
            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                const count = frequencies[i];
                for (let j = 0; j < count; j++) {
                    const filename = path.join(testDir, `${token}-${j}.ts`);
                    await fs.writeFile(filename, `import '${token}';`);
                }
            }
            const analysis = await analyzeRepo(testDir);
            expect(analysis.topTokens[0][0]).toBe("common");
            expect(analysis.topTokens[0][1]).toBe(10);
            expect(analysis.topTokens[1][0]).toBe("uncommon");
            expect(analysis.topTokens[1][1]).toBe(3);
            expect(analysis.topTokens[2][0]).toBe("rare");
            expect(analysis.topTokens[2][1]).toBe(1);
        });
        test("should detect scoped packages", async () => {
            const tsFile = `
        import { a } from '@scope/frequent-package';
        import { b } from '@another/scope';
      `;
            await fs.writeFile(path.join(testDir, "index.ts"), tsFile);
            const analysis = await analyzeRepo(testDir);
            expect(analysis.topTokens.some(([token]) => token.includes("scope"))).toBe(true);
            expect(analysis.topTokens.some(([token]) => token.includes("another"))).toBe(true);
        });
    });
});
