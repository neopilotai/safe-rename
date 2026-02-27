import { describe, test, expect } from "bun:test";
import {
  processTypeScriptFile,
  processJsonFile,
  processYamlFile,
  processEnvFile,
  processDockerFile,
  processMarkdownFile
} from "../src/engine";

describe("Engine Tests", () => {
  describe("processTypeScriptFile", () => {
    test("should rename import statements", () => {
      const content = `import { something } from 'old-package';`;
      const options = { oldName: "old-package", newName: "new-package" };
      const result = processTypeScriptFile(content, options);
      expect(result).toContain("from 'new-package'");
    });

    test("should rename export statements", () => {
      const content = `export { something } from 'old-package';`;
      const options = { oldName: "old-package", newName: "new-package" };
      const result = processTypeScriptFile(content, options);
      expect(result).toContain("from 'new-package'");
    });

    test("should rename require statements", () => {
      const content = `const pkg = require('old-package');`;
      const options = { oldName: "old-package", newName: "new-package" };
      const result = processTypeScriptFile(content, options);
      expect(result).toContain("require('new-package')");
    });

    test("should rename scoped packages", () => {
      const content = `import { something } from '@company/old-name';`;
      const options = { oldName: "@company/old-name", newName: "@company/new-name" };
      const result = processTypeScriptFile(content, options);
      expect(result).toContain("from '@company/new-name'");
    });

    test("should handle multi-map renames", () => {
      const content = `
        import { a } from 'pkg1';
        import { b } from 'pkg2';
      `;
      const options = {
        oldName: "pkg1",
        newName: "newpkg1",
        multiMap: { "pkg1": "newpkg1", "pkg2": "newpkg2" }
      };
      const result = processTypeScriptFile(content, options);
      expect(result).toContain("from 'newpkg1'");
      expect(result).toContain("from 'newpkg2'");
    });

    test("should respect case sensitivity", () => {
      const content = `const MyComponent = 'test';`;
      const options = { oldName: "MyComponent", newName: "MyNewComponent", caseSensitive: true };
      const result = processTypeScriptFile(content, options);
      expect(result).toContain("MyNewComponent");
    });
  });

  describe("processJsonFile", () => {
    test("should rename string values", () => {
      const content = `{"name": "old-package", "version": "1.0.0"}`;
      const options = { oldName: "old-package", newName: "new-package" };
      const result = processJsonFile(content, options);
      expect(result).toContain('"name": "new-package"');
    });

    test("should rename object keys", () => {
      const content = `{"old-key": "value"}`;
      const options = { oldName: "old-key", newName: "new-key" };
      const result = processJsonFile(content, options);
      expect(result).toContain('"new-key": "value"');
    });

    test("should handle nested objects", () => {
      const content = `{"nested": {"old-key": "value"}}`;
      const options = { oldName: "old-key", newName: "new-key" };
      const result = processJsonFile(content, options);
      expect(result).toContain('"new-key": "value"');
    });

    test("should handle arrays", () => {
      const content = `{"items": ["old-item", "other"]}`;
      const options = { oldName: "old-item", newName: "new-item" };
      const result = processJsonFile(content, options);
      expect(result).toContain('"new-item"');
    });
  });

  describe("processYamlFile", () => {
    test("should rename yaml values", () => {
      const content = `service: old-service\nversion: 1.0`;
      const options = { oldName: "old-service", newName: "new-service" };
      const result = processYamlFile(content, options);
      expect(result).toContain("service: new-service");
    });

    test("should rename yaml keys", () => {
      const content = `old-key: value`;
      const options = { oldName: "old-key", newName: "new-key" };
      const result = processYamlFile(content, options);
      expect(result).toContain("new-key: value");
    });
  });

  describe("processEnvFile", () => {
    test("should rename environment variables", () => {
      const content = `OLD_VAR=value\nOTHER=test`;
      const options = { oldName: "OLD_VAR", newName: "NEW_VAR" };
      const result = processEnvFile(content, options);
      expect(result).toContain("NEW_VAR=value");
    });

    test("should convert to uppercase", () => {
      const content = `old_var=value`;
      const options = { oldName: "old_var", newName: "new_var" };
      const result = processEnvFile(content, options);
      expect(result).toContain("NEW_VAR=value");
    });
  });

  describe("processDockerFile", () => {
    test("should rename FROM instructions", () => {
      const content = `FROM old-registry/image:tag`;
      const options = { oldName: "old-registry", newName: "new-registry" };
      const result = processDockerFile(content, options);
      expect(result).toContain("FROM new-registry/image:tag");
    });

    test("should rename image references", () => {
      const content = `image: old-service:latest`;
      const options = { oldName: "old-service", newName: "new-service" };
      const result = processDockerFile(content, options);
      expect(result).toContain("image: new-service:latest");
    });

    test("should rename ENV variables", () => {
      const content = `ENV OLD_VAR=value`;
      const options = { oldName: "OLD_VAR", newName: "NEW_VAR" };
      const result = processDockerFile(content, options);
      expect(result).toContain("ENV NEW_VAR=value");
    });
  });

  describe("processMarkdownFile", () => {
    test("should rename in code blocks", () => {
      const content = `\`\`\`javascript\nimport 'old-package';\n\`\`\``;
      const options = { oldName: "old-package", newName: "new-package" };
      const result = processMarkdownFile(content, options);
      expect(result).toContain("import 'new-package';");
    });

    test("should rename in inline code", () => {
      const content = `Use \`old-package\` for testing.`;
      const options = { oldName: "old-package", newName: "new-package" };
      const result = processMarkdownFile(content, options);
      expect(result).toContain("`new-package`");
    });

    test("should rename in links", () => {
      const content = `[Link](https://example.com/old-package/docs)`;
      const options = { oldName: "old-package", newName: "new-package" };
      const result = processMarkdownFile(content, options);
      expect(result).toContain("(https://example.com/new-package/docs)");
    });

    test("should rename in regular text", () => {
      const content = `This is about old-package.`;
      const options = { oldName: "old-package", newName: "new-package" };
      const result = processMarkdownFile(content, options);
      expect(result).toContain("This is about new-package.");
    });
  });
});
