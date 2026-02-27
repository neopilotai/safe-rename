# Safe Rename

Enterprise-grade repository refactoring tool with AI-powered rename planning and safe execution across multiple file types.

## 🚀 Features

### CLI Tool
- **Multi-file Support**: TypeScript, JavaScript, JSON, YAML, ENV, Docker, Markdown
- **Smart Renaming**: Package.json updates, Git remote updates
- **Safe Operations**: Dry-run mode, case-sensitive options
- **Batch Processing**: Multi-map renames for complex refactors
- **Performance**: Parallel processing with concurrency limits

### AI Planner
- **Repository Analysis**: Frequency-based token detection
- **Pattern Recognition**: Import/export patterns, environment variables, Docker images
- **Smart Suggestions**: Top 20 most frequent tokens identification

### VSCode Extension
- **Webview UI**: Interactive rename planning interface
- **Direct Integration**: Seamless CLI integration
- **Real-time Feedback**: Live preview of changes

### GitHub Action
- **Automated Refactoring**: Bot-powered repository updates
- **PR Workflow**: Automatic pull request creation
- **Safe Execution**: Controlled rename operations

## 📦 Installation

```bash
# Install dependencies
bun install

# Build the project
bun build

# Install globally for CLI usage
bun link
```

## 🔧 Usage

### CLI

```bash
# Basic rename
safe-rename --old-name "oldPackage" --new-name "newPackage"

# Dry run (preview changes)
safe-rename --old-name "oldPackage" --new-name "newPackage" --dry

# Update package.json and git remotes
safe-rename --old-name "oldPackage" --new-name "newPackage" --update-package --update-remote

# Multi-map rename (batch operations)
safe-rename --multi-map '{"old1":"new1","old2":"new2"}' --dry

# Case-sensitive rename
safe-rename --old-name "MyComponent" --new-name "MyNewComponent" --case-sensitive
```

### AI Planner

```bash
# Analyze repository for rename suggestions
bun run src/planner.ts
```

### VSCode Extension

1. Install the extension from the marketplace
2. Open Command Palette (`Cmd+Shift+P`)
3. Run "Safe Rename: Open Planner"
4. Use the webview UI to plan and execute renames

### GitHub Action

Add to your `.github/workflows/safe-rename.yml`:

```yaml
name: Safe Rename Bot

on:
  workflow_dispatch:
    inputs:
      old-name:
        description: 'Old name to rename'
        required: true
      new-name:
        description: 'New name to rename'
        required: true
      update-package:
        description: 'Update package.json'
        type: boolean
        default: true
      update-remote:
        description: 'Update git remotes'
        type: boolean
        default: true

jobs:
  rename:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: |
          bunx safe-rename \
            --old-name "${{ github.event.inputs.old-name }}" \
            --new-name "${{ github.event.inputs.new-name }}" \
            --update-package="${{ github.event.inputs.update-package }}" \
            --update-remote="${{ github.event.inputs.update-remote }}"
      # ... PR creation steps
```

## 🎯 Supported File Types

| Type | Extensions | Features |
|------|------------|----------|
| **TypeScript/JavaScript** | `.ts`, `.tsx`, `.js`, `.jsx` | Import/Export renaming, variable names, scoped packages |
| **JSON** | `.json` | Key/value renaming, nested object support |
| **YAML** | `.yml`, `.yaml` | Configuration file updates |
| **Environment** | `.env*` | Variable name updates |
| **Docker** | `Dockerfile*`, `docker-compose*` | Image names, environment variables |
| **Markdown** | `.md` | Code blocks, links, text content |

## ⚙️ Configuration

Create a `.saferenamerc.json` file in your project root:

```json
{
  "updatePackage": true,
  "updateRemote": true,
  "caseSensitive": false,
  "ignore": [
    "node_modules/**",
    "dist/**",
    "build/**",
    ".git/**"
  ],
  "include": [
    "**/*.{ts,tsx,js,jsx}",
    "**/*.{json,yml,yaml}",
    "**/*.env*",
    "**/Dockerfile*",
    "**/docker-compose*",
    "**/*.md"
  ]
}
```

## 🔍 Examples

### Package Rename
```bash
# Rename a package across the entire codebase
safe-rename --old-name "@company/old-package" --new-name "@company/new-package" --update-package
```

### Component Rename
```bash
# Rename React component (case-sensitive)
safe-rename --old-name "MyComponent" --new-name "MyNewComponent" --case-sensitive
```

### Environment Variable Rename
```bash
# Rename environment variables
safe-rename --old-name "API_ENDPOINT" --new-name "SERVICE_URL" --dry
```

### Docker Image Rename
```bash
# Update Docker references
safe-rename --old-name "old-registry" --new-name "new-registry" --update-remote
```

## 🧪 Testing

```bash
# Run tests
bun test

# Run with coverage
bun test --coverage

# Run specific test file
bun test tests/engine.test.ts
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## 📝 Development

```bash
# Install development dependencies
bun install

# Run in development mode
bun dev

# Build for production
bun build

# Run linting
bun lint

# Format code
bun format
```

## 🛡️ Safety Features

- **Dry Run Mode**: Preview changes before applying
- **Backup Creation**: Automatic backup before major changes
- **Rollback Support**: Undo functionality for failed operations
- **Validation**: Syntax checking before file modifications
- **Git Integration**: Automatic commit creation for changes

## 📊 Performance

- **Parallel Processing**: Handles large codebases efficiently
- **Memory Optimized**: Streaming file processing
- **Concurrent Operations**: Configurable concurrency limits
- **Smart Caching**: Avoids redundant file operations

## 🔒 Security

- **No External Dependencies**: Core functionality is self-contained
- **Local Processing**: All operations happen locally
- **Git Safety**: Respects `.gitignore` and sensitive files
- **Permission Checks**: Validates file access before modifications

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Check the wiki for detailed guides
- **Examples**: See the `examples/` directory for sample use cases

---

**Built with ❤️ for safe and efficient codebase refactoring**
