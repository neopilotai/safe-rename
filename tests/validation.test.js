import { describe, test, expect } from "bun:test";
import { validateRenameOptions, validateMultiMap, validateConfig, formatValidationErrors, ValidationError, FileProcessingError, ConfigError } from "../src/validation";
describe("Validation Module Tests", () => {
    describe("validateRenameOptions", () => {
        test("should pass with valid names", () => {
            const result = validateRenameOptions("old-name", "new-name");
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
        test("should fail when old name is empty", () => {
            const result = validateRenameOptions("", "new-name");
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].field).toBe("oldName");
            expect(result.errors[0].message).toContain("required");
        });
        test("should fail when new name is empty", () => {
            const result = validateRenameOptions("old-name", "");
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].field).toBe("newName");
            expect(result.errors[0].message).toContain("required");
        });
        test("should fail when names are the same", () => {
            const result = validateRenameOptions("same", "same");
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].field).toBe("newName");
            expect(result.errors[0].message).toContain("different");
        });
        test("should fail when names exceed 255 characters", () => {
            const longName = "a".repeat(256);
            const result = validateRenameOptions(longName, "new-name");
            expect(result.isValid).toBe(false);
            expect(result.errors[0].field).toBe("oldName");
            expect(result.errors[0].message).toContain("255 characters");
        });
        test("should fail when names contain invalid characters", () => {
            const result = validateRenameOptions("bad:name", "new-name");
            expect(result.isValid).toBe(false);
            expect(result.errors[0].field).toBe("oldName");
            expect(result.errors[0].message).toContain("invalid characters");
        });
        test("should pass with valid special characters", () => {
            const result = validateRenameOptions("my-component", "my-new-component");
            expect(result.isValid).toBe(true);
        });
    });
    describe("validateMultiMap", () => {
        test("should pass with valid multi-map", () => {
            const multiMap = {
                "pkg1": "newpkg1",
                "pkg2": "newpkg2"
            };
            const result = validateMultiMap(multiMap);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
        test("should fail with invalid multi-map type", () => {
            const result = validateMultiMap("not-an-object");
            expect(result.isValid).toBe(false);
            expect(result.errors[0].field).toBe("multiMap");
            expect(result.errors[0].message).toContain("valid object");
        });
        test("should fail when multi-map contains invalid entries", () => {
            const multiMap = {
                "": "newpkg1",
                "pkg2": ""
            };
            const result = validateMultiMap(multiMap);
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
        test("should validate all entries in multi-map", () => {
            const multiMap = {
                "pkg1": "pkg1", // Same names - should fail
                "": "newpkg2", // Empty old name - should fail
                "pkg3": "newpkg3" // Valid - should pass
            };
            const result = validateMultiMap(multiMap);
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(1);
        });
    });
    describe("validateConfig", () => {
        test("should pass with valid config", () => {
            const config = {
                updatePackage: true,
                updateRemote: false,
                caseSensitive: true,
                dry: false,
                concurrency: 10,
                ignore: ["node_modules/**"],
                include: ["**/*.ts"]
            };
            const result = validateConfig(config);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
        test("should fail with invalid boolean fields", () => {
            const config = {
                updatePackage: "true",
                updateRemote: 1,
                caseSensitive: null,
                dry: "false"
            };
            const result = validateConfig(config);
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(4);
        });
        test("should fail with invalid array fields", () => {
            const config = {
                ignore: "not-array",
                include: 123
            };
            const result = validateConfig(config);
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(2);
        });
        test("should fail with invalid concurrency", () => {
            const config = {
                concurrency: 0
            };
            const result = validateConfig(config);
            expect(result.isValid).toBe(false);
            expect(result.errors[0].field).toBe("concurrency");
            expect(result.errors[0].message).toContain("between 1 and 100");
        });
        test("should fail with concurrency too high", () => {
            const config = {
                concurrency: 101
            };
            const result = validateConfig(config);
            expect(result.isValid).toBe(false);
            expect(result.errors[0].field).toBe("concurrency");
            expect(result.errors[0].message).toContain("between 1 and 100");
        });
    });
    describe("formatValidationErrors", () => {
        test("should format single error", () => {
            const errors = [{
                    field: "oldName",
                    message: "is required",
                    value: ""
                }];
            const formatted = formatValidationErrors(errors);
            expect(formatted).toContain("❌ oldName: is required");
            expect(formatted).toContain('(value: "")');
        });
        test("should format multiple errors", () => {
            const errors = [
                { field: "oldName", message: "is required" },
                { field: "newName", message: "is too long" }
            ];
            const formatted = formatValidationErrors(errors);
            expect(formatted).toContain("❌ oldName: is required");
            expect(formatted).toContain("❌ newName: is too long");
            expect(formatted).toMatch(/.*\n.*/); // Should have line breaks
        });
        test("should return empty string for no errors", () => {
            const formatted = formatValidationErrors([]);
            expect(formatted).toBe("");
        });
    });
    describe("Custom Error Classes", () => {
        test("ValidationError should contain validation errors", () => {
            const validationErrors = [
                { field: "oldName", message: "is required" }
            ];
            const error = new ValidationError(validationErrors);
            expect(error.name).toBe("ValidationError");
            expect(error.code).toBe("VALIDATION_ERROR");
            expect(error.validationErrors).toEqual(validationErrors);
            expect(error.message).toContain("❌ oldName: is required");
        });
        test("FileProcessingError should contain file path", () => {
            const originalError = new Error("File not found");
            const error = new FileProcessingError("/path/to/file.ts", originalError);
            expect(error.name).toBe("FileProcessingError");
            expect(error.code).toBe("FILE_PROCESSING_ERROR");
            expect(error.details?.filePath).toBe("/path/to/file.ts");
            expect(error.details?.originalError).toBe("File not found");
            expect(error.message).toContain("/path/to/file.ts");
        });
        test("ConfigError should contain config path", () => {
            const originalError = new Error("Invalid JSON");
            const error = new ConfigError("/path/to/config.json", originalError);
            expect(error.name).toBe("ConfigError");
            expect(error.code).toBe("CONFIG_ERROR");
            expect(error.details?.configPath).toBe("/path/to/config.json");
            expect(error.details?.originalError).toBe("Invalid JSON");
            expect(error.message).toContain("/path/to/config.json");
        });
    });
});
