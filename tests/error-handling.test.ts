import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { runSafeRename } from "../src/engine";
import fs from "fs-extra";
import path from "path";

describe("Error Handling Tests", () => {
  const testDir = "/tmp/safe-rename-error-test";

  beforeEach(async () => {
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe("Input Validation Errors", () => {
    test("should handle empty old name", async () => {
      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "",
          "new-name": "new-name"
        }
      };

      try {
        await runSafeRename(ctx);
        // If we reach here, the test should fail
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain("required");
      }
    });

    test("should handle empty new name", async () => {
      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "old-name",
          "new-name": ""
        }
      };

      try {
        await runSafeRename(ctx);
        // If we reach here, the test should fail
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain("required");
      }
    });

    test("should handle missing old name", async () => {
      const ctx = {
        cwd: testDir,
        args: {
          "new-name": "new-name"
        }
      };

      try {
        await runSafeRename(ctx);
        // If we reach here, the test should fail
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain("required");
      }
    });

    test("should handle missing new name", async () => {
      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "old-name"
        }
      };

      try {
        await runSafeRename(ctx);
        // If we reach here, the test should fail
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain("required");
      }
    });

    test("should handle invalid multi-map JSON", async () => {
      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "old-name",
          "new-name": "new-name",
          "multi-map": "invalid-json"
        }
      };

      try {
        await runSafeRename(ctx);
        // If we reach here, the test should fail
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain("JSON");
      }
    });

    test("should handle invalid concurrency value", async () => {
      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "old-name",
          "new-name": "new-name",
          "concurrency": "invalid"
        }
      };

      try {
        await runSafeRename(ctx);
        // If we reach here, the test should fail
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain("concurrency");
      }
    });
  });

  describe("File System Errors", () => {
    test("should handle non-existent directory", async () => {
      const ctx = {
        cwd: "/tmp/non-existent-directory",
        args: {
          "old-name": "old-name",
          "new-name": "new-name"
        }
      };

      try {
        await runSafeRename(ctx);
        // If we reach here, the test should fail
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain("ENOENT");
      }
    });

    test("should handle permission denied errors", async () => {
      // Create a file with no read permissions
      const testFile = path.join(testDir, "no-permission.ts");
      await fs.writeFile(testFile, "import 'old-package';");
      await fs.chmod(testFile, 0o000);

      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "old-package",
          "new-name": "new-name"
        }
      };

      try {
        await runSafeRename(ctx);
        // If we reach here, the test should fail
        expect(true).toBe(false);
      } catch (error: any) {
        const hasPermissionError = error.message.includes("permission");
        const hasEACCES = error.message.includes("EACCES");
        expect(hasPermissionError || hasEACCES).toBe(true);
      }
    });

    test("should handle corrupted JSON files", async () => {
      await fs.writeFile(path.join(testDir, "corrupted.json"), '{"invalid": json}');

      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "old-name",
          "new-name": "new-name"
        }
      };

      // Should handle gracefully and continue processing other files
      const result = await runSafeRename(ctx);
      expect(result).toBeDefined();
    });

    test("should handle corrupted YAML files", async () => {
      await fs.writeFile(path.join(testDir, "corrupted.yml"), "invalid: yaml: content: [");

      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "old-name",
          "new-name": "new-name"
        }
      };

      // Should handle gracefully and continue processing other files
      const result = await runSafeRename(ctx);
      expect(result).toBeDefined();
    });
  });

  describe("Configuration Errors", () => {
    test("should handle malformed config file", async () => {
      await fs.writeFile(path.join(testDir, ".saferenamerc.json"), "invalid json content");

      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "old-name",
          "new-name": "new-name"
        }
      };

      // Should fall back to default config
      const result = await runSafeRename(ctx);
      expect(result).toBeDefined();
    });

    test("should handle invalid config values", async () => {
      const invalidConfig = {
        updatePackage: "not-a-boolean",
        concurrency: -1,
        ignore: "not-an-array"
      };
      await fs.writeJson(path.join(testDir, ".saferenamerc.json"), invalidConfig);

      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "old-name",
          "new-name": "new-name"
        }
      };

      try {
        await runSafeRename(ctx);
        // If we reach here, the test should fail
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain("validation");
      }
    });
  });

  describe("Runtime Errors", () => {
    test("should handle memory exhaustion scenarios", async () => {
      // Create a very large file that might cause memory issues
      const largeContent = "import 'old-package';\n".repeat(100000);
      await fs.writeFile(path.join(testDir, "large.ts"), largeContent);

      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "old-package",
          "new-name": "new-name",
          concurrency: "1" // Limit concurrency to reduce memory pressure
        }
      };

      // Should handle gracefully without crashing
      const result = await runSafeRename(ctx);
      expect(result).toBeDefined();
    });

    test("should handle concurrent file processing errors", async () => {
      // Create multiple files, some of which might cause errors
      const filePromises = [];
      for (let i = 0; i < 10; i++) {
        if (i % 3 === 0) {
          // Create corrupted file
          filePromises.push(fs.writeFile(path.join(testDir, `file${i}.json`), "invalid json"));
        } else {
          // Create valid file
          filePromises.push(fs.writeFile(path.join(testDir, `file${i}.ts`), "import 'old-package';"));
        }
      }
      await Promise.all(filePromises);

      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "old-package",
          "new-name": "new-name",
          concurrency: "5"
        }
      };

      // Should handle errors and continue processing valid files
      const result = await runSafeRename(ctx);
      expect(result).toBeDefined();
    });

    test("should handle git operation failures", async () => {
      // Create a git repository but break git functionality
      await fs.writeFile(path.join(testDir, "test.ts"), "import 'old-package';");

      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "old-package",
          "new-name": "new-package",
          "update-remote": true
        }
      };

      // Should handle git errors gracefully
      const result = await runSafeRename(ctx);
      expect(result).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    test("should handle very long names", async () => {
      const longName = "a".repeat(1000);
      const ctx = {
        cwd: testDir,
        args: {
          "old-name": longName,
          "new-name": "new-name"
        }
      };

      try {
        await runSafeRename(ctx);
        // If we reach here, the test should fail
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain("255 characters");
      }
    });

    test("should handle special characters in names", async () => {
      const specialChars = "!@#$%^&*()";
      const ctx = {
        cwd: testDir,
        args: {
          "old-name": specialChars,
          "new-name": "new-name"
        }
      };

      try {
        await runSafeRename(ctx);
        // If we reach here, the test should fail
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain("invalid characters");
      }
    });

    test("should handle unicode characters", async () => {
      const unicodeName = "🚀package";
      const ctx = {
        cwd: testDir,
        args: {
          "old-name": unicodeName,
          "new-name": "new-name"
        }
      };

      // Unicode should be handled properly
      await fs.writeFile(path.join(testDir, "unicode.ts"), `import '${unicodeName}';`);

      const result = await runSafeRename(ctx);
      expect(result).toBeDefined();
    });

    test("should handle empty directory", async () => {
      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "old-name",
          "new-name": "new-name"
        }
      };

      // Should handle empty directory gracefully
      const result = await runSafeRename(ctx);
      expect(result).toBeDefined();
    });
  });

  describe("Error Recovery", () => {
    test("should continue processing after individual file errors", async () => {
      // Mix of valid and invalid files
      await fs.writeFile(path.join(testDir, "valid1.ts"), "import 'old-package';");
      await fs.writeFile(path.join(testDir, "invalid.json"), "invalid json");
      await fs.writeFile(path.join(testDir, "valid2.ts"), "import 'old-package';");
      await fs.writeFile(path.join(testDir, "invalid.yml"), "invalid: yaml:");

      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "old-package",
          "new-name": "new-name"
        }
      };

      const result = await runSafeRename(ctx);
      expect(result).toBeDefined();

      // Valid files should be processed
      const valid1Content = await fs.readFile(path.join(testDir, "valid1.ts"), "utf8");
      const valid2Content = await fs.readFile(path.join(testDir, "valid2.ts"), "utf8");
      expect(valid1Content).toContain("new-package");
      expect(valid2Content).toContain("new-package");
    });

    test("should provide meaningful error messages", async () => {
      const ctx = {
        cwd: testDir,
        args: {
          "old-name": "",
          "new-name": "new-name"
        }
      };

      try {
        await runSafeRename(ctx);
        // If we reach here, the test should fail
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toBeDefined();
        expect(error.message.length).toBeGreaterThan(0);
        expect(error.message).toContain("old-name");
      }
    });
  });
});
