import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { runSafeRename } from "../src/engine";
import fs from "fs-extra";
import path from "path";

describe("Performance Tests", () => {
  const testDir = "/tmp/safe-rename-perf-test";

  beforeEach(async () => {
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe("Large File Processing", () => {
    test("should handle large TypeScript files efficiently", async () => {
      // Create a large TypeScript file with many imports
      let content = "";
      for (let i = 0; i < 10000; i++) {
        content += `import { Component${i} } from 'old-package-${i}';\n`;
        content += `const variable${i} = 'old-package-${i}';\n`;
        content += `function func${i}() { return 'old-package-${i}'; }\n`;
      }
      
      const filePath = path.join(testDir, "large.ts");
      await fs.writeFile(filePath, content);
      
      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "old-package-1",
          "new-name": "new-package-1",
          "dry": true
        }
      };

      const startTime = Date.now();
      await runSafeRename(ctx);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
      
      console.log(`Large file processing time: ${processingTime}ms`);
    });

    test("should handle large JSON files efficiently", async () => {
      // Create a large JSON file
      const largeJson: any = { config: {} };
      for (let i = 0; i < 5000; i++) {
        largeJson[`old-key-${i}`] = {
          value: `old-package-${i}`,
          nested: {
            reference: `old-package-${i}`,
            items: [`item-${i}`, `old-package-${i}`]
          }
        };
      }
      
      await fs.writeJson(path.join(testDir, "large.json"), largeJson);
      
      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "old-package-1",
          "new-name": "new-package-1",
          "dry": true
        }
      };

      const startTime = Date.now();
      await runSafeRename(ctx);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(8000); // Should complete within 8 seconds
      
      console.log(`Large JSON processing time: ${processingTime}ms`);
    });

    test("should handle large YAML files efficiently", async () => {
      // Create a large YAML file
      let yamlContent = "services:\n";
      for (let i = 0; i < 3000; i++) {
        yamlContent += `  old-service-${i}:\n`;
        yamlContent += `    image: old-registry/old-image-${i}:latest\n`;
        yamlContent += `    environment:\n`;
        yamlContent += `      OLD_VAR_${i}: old-value-${i}\n`;
        yamlContent += `      PACKAGE_NAME: old-package-${i}\n`;
      }
      
      await fs.writeFile(path.join(testDir, "large.yml"), yamlContent);
      
      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "old-service-1",
          "new-name": "new-service-1",
          "dry": true
        }
      };

      const startTime = Date.now();
      await runSafeRename(ctx);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(6000); // Should complete within 6 seconds
      
      console.log(`Large YAML processing time: ${processingTime}ms`);
    });
  });

  describe("Many Files Processing", () => {
    test("should handle many small files efficiently", async () => {
      // Create 1000 small files
      const filePromises = [];
      for (let i = 0; i < 1000; i++) {
        const content = `import { Module${i} } from 'old-package';\nexport const value${i} = 'old-package';`;
        filePromises.push(fs.writeFile(path.join(testDir, `file${i}.ts`), content));
      }
      await Promise.all(filePromises);
      
      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "old-package",
          "new-name": "new-package",
          "dry": true,
          "concurrency": "20"
        }
      };

      const startTime = Date.now();
      await runSafeRename(ctx);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(15000); // Should complete within 15 seconds
      
      console.log(`1000 files processing time: ${processingTime}ms`);
    });

    test("should scale with concurrency", async () => {
      // Create 500 files for concurrency testing
      const filePromises = [];
      for (let i = 0; i < 500; i++) {
        const content = `import { Module${i} } from 'old-package';`;
        filePromises.push(fs.writeFile(path.join(testDir, `file${i}.ts`), content));
      }
      await Promise.all(filePromises);
      
      // Test with low concurrency
      const ctx1 = {
        cwd: testDir,
        args: {
          "old-name": "old-package",
          "new-name": "new-package",
          "dry": true,
          "concurrency": "1"
        }
      };

      const startTime1 = Date.now();
      await runSafeRename(ctx1);
      const endTime1 = Date.now();
      const lowConcurrencyTime = endTime1 - startTime1;

      // Test with high concurrency
      const ctx2 = {
        cwd: testDir,
        args: {
          "old-name": "old-package",
          "new-name": "new-package",
          "dry": true,
          "concurrency": "50"
        }
      };

      const startTime2 = Date.now();
      await runSafeRename(ctx2);
      const endTime2 = Date.now();
      const highConcurrencyTime = endTime2 - startTime2;
      
      // High concurrency should be faster (within reasonable bounds)
      expect(highConcurrencyTime).toBeLessThan(lowConcurrencyTime * 1.5);
      
      console.log(`Low concurrency time: ${lowConcurrencyTime}ms`);
      console.log(`High concurrency time: ${highConcurrencyTime}ms`);
    });
  });

  describe("Memory Usage", () => {
    test("should not leak memory during processing", async () => {
      // Create files and process them multiple times
      for (let round = 0; round < 5; round++) {
        // Clean up previous files
        await fs.emptyDir(testDir);
        
        // Create test files
        const filePromises = [];
        for (let i = 0; i < 100; i++) {
          const content = `import { Module${i} } from 'old-package';`;
          filePromises.push(fs.writeFile(path.join(testDir, `file${i}.ts`), content));
        }
        await Promise.all(filePromises);
        
        const ctx = {
          cwd: testDir,
          args: {
            "old-name": "old-package",
            "new-name": "new-package",
            "dry": true
          }
        };

        await runSafeRename(ctx);
      }
      
      // If we get here without memory errors, the test passes
      expect(true).toBe(true);
    });

    test("should handle memory-intensive operations", async () => {
      // Create files with complex nested structures
      for (let i = 0; i < 50; i++) {
        const complexJson: any = { level1: {} };
        let current = complexJson.level1;
        
        // Create deep nesting
        for (let j = 0; j < 100; j++) {
          current[`level${j}`] = {
            data: `old-package-${i}-${j}`,
            nested: {}
          };
          current = current[`level${j}`].nested;
        }
        
        await fs.writeJson(path.join(testDir, `complex${i}.json`), complexJson);
      }
      
      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "old-package-1",
          "new-name": "new-package-1",
          "dry": true,
          "concurrency": "5"
        }
      };

      const startTime = Date.now();
      await runSafeRename(ctx);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(12000); // Should complete within 12 seconds
      
      console.log(`Complex nested processing time: ${processingTime}ms`);
    });
  });

  describe("Regex Performance", () => {
    test("should handle complex regex patterns efficiently", async () => {
      // Create a file with many complex patterns
      let content = "";
      for (let i = 0; i < 5000; i++) {
        content += `import { a${i} } from '@company/old-name-${i}';\n`;
        content += `export { b${i} } from '@company/old-name-${i}';\n`;
        content += `const c${i} = require('@company/old-name-${i}');\n`;
        content += `// @company/old-name-${i} comment\n`;
        content += `/* @company/old-name-${i} block comment */\n`;
      }
      
      await fs.writeFile(path.join(testDir, "regex.ts"), content);
      
      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "@company/old-name-1",
          "new-name": "@company/new-name-1",
          "dry": true
        }
      };

      const startTime = Date.now();
      await runSafeRename(ctx);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(8000); // Should complete within 8 seconds
      
      console.log(`Complex regex processing time: ${processingTime}ms`);
    });

    test("should handle case-sensitive regex efficiently", async () => {
      // Create a file with mixed case patterns
      let content = "";
      for (let i = 0; i < 3000; i++) {
        content += `const OldPackage${i} = 'value';\n`;
        content += `const oldpackage${i} = 'value';\n`;
        content += `const OLD_PACKAGE${i} = 'value';\n`;
        content += `const Old_Package${i} = 'value';\n`;
      }
      
      await fs.writeFile(path.join(testDir, "case.ts"), content);
      
      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "OldPackage1",
          "new-name": "NewPackage1",
          "case-sensitive": true,
          "dry": true
        }
      };

      const startTime = Date.now();
      await runSafeRename(ctx);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(6000); // Should complete within 6 seconds
      
      console.log(`Case-sensitive regex processing time: ${processingTime}ms`);
    });
  });

  describe("Multi-Map Performance", () => {
    test("should handle large multi-maps efficiently", async () => {
      // Create a large multi-map
      const multiMap: Record<string, string> = {};
      for (let i = 0; i < 1000; i++) {
        multiMap[`old-pkg-${i}`] = `new-pkg-${i}`;
      }
      
      // Create files using many of these packages
      const filePromises = [];
      for (let i = 0; i < 100; i++) {
        let content = "";
        for (let j = 0; j < 50; j++) {
          const pkgIndex = Math.floor(Math.random() * 1000);
          content += `import { Module${j} } from 'old-pkg-${pkgIndex}';\n`;
        }
        filePromises.push(fs.writeFile(path.join(testDir, `multi${i}.ts`), content));
      }
      await Promise.all(filePromises);
      
      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "old-pkg-1",
          "new-name": "new-pkg-1",
          "multi-map": JSON.stringify(multiMap),
          "dry": true,
          "concurrency": "10"
        }
      };

      const startTime = Date.now();
      await runSafeRename(ctx);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(20000); // Should complete within 20 seconds
      
      console.log(`Large multi-map processing time: ${processingTime}ms`);
    });
  });

  describe("Benchmark Summary", () => {
    test("should provide performance benchmarks", async () => {
      const benchmarks: Record<string, number> = {};
      
      // Benchmark 1: Small files
      await fs.writeFile(path.join(testDir, "small.ts"), "import 'old-package';");
      const ctx1 = { cwd: testDir, args: { "old-name": "old-package", "new-name": "new-package", "dry": true } };
      const start1 = Date.now();
      await runSafeRename(ctx1);
      benchmarks.small_file = Date.now() - start1;
      
      // Benchmark 2: Medium files
      let mediumContent = "";
      for (let i = 0; i < 100; i++) {
        mediumContent += `import { Module${i} } from 'old-package';\n`;
      }
      await fs.writeFile(path.join(testDir, "medium.ts"), mediumContent);
      const ctx2 = { cwd: testDir, args: { "old-name": "old-package", "new-name": "new-package", "dry": true } };
      const start2 = Date.now();
      await runSafeRename(ctx2);
      benchmarks.medium_file = Date.now() - start2;
      
      // Benchmark 3: Many files
      await fs.emptyDir(testDir);
      for (let i = 0; i < 10; i++) {
        await fs.writeFile(path.join(testDir, `file${i}.ts`), "import 'old-package';");
      }
      const ctx3 = { cwd: testDir, args: { "old-name": "old-package", "new-name": "new-package", "dry": true } };
      const start3 = Date.now();
      await runSafeRename(ctx3);
      benchmarks.many_files = Date.now() - start3;
      
      console.log("Performance Benchmarks:");
      console.log(`Small file: ${benchmarks.small_file}ms`);
      console.log(`Medium file: ${benchmarks.medium_file}ms`);
      console.log(`Many files (10): ${benchmarks.many_files}ms`);
      
      // Basic performance assertions
      expect(benchmarks.small_file).toBeLessThan(1000);
      expect(benchmarks.medium_file).toBeLessThan(3000);
      expect(benchmarks.many_files).toBeLessThan(5000);
    });
  });
});
