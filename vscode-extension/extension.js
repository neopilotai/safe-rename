import * as vscode from "vscode";
import { exec } from "child_process";
import { analyzeRepo } from "../src/planner";
export function activate(context) {
    const cmd = vscode.commands.registerCommand("safeRename.openUI", () => {
        const panel = vscode.window.createWebviewPanel("safeRename", "Safe Rename Planner", vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true
        });
        panel.webview.html = getWebviewContent(panel.webview);
        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case "analyzeRepo":
                    try {
                        const workspaceFolders = vscode.workspace.workspaceFolders;
                        if (!workspaceFolders) {
                            panel.webview.postMessage({
                                type: "error",
                                message: "No workspace folder found"
                            });
                            return;
                        }
                        const analysis = await analyzeRepo(workspaceFolders[0].uri.fsPath);
                        panel.webview.postMessage({
                            type: "analysisComplete",
                            data: analysis
                        });
                    }
                    catch (error) {
                        panel.webview.postMessage({
                            type: "error",
                            message: `Analysis failed: ${error}`
                        });
                    }
                    break;
                case "executeRename":
                    try {
                        const workspaceFolders = vscode.workspace.workspaceFolders;
                        if (!workspaceFolders) {
                            panel.webview.postMessage({
                                type: "error",
                                message: "No workspace folder found"
                            });
                            return;
                        }
                        const { oldName, newName, options } = message.data;
                        let command = `bunx safe-rename --old-name "${oldName}" --new-name "${newName}"`;
                        if (options.dryRun) {
                            command += " --dry";
                        }
                        if (options.updatePackage) {
                            command += " --update-package";
                        }
                        if (options.updateRemote) {
                            command += " --update-remote";
                        }
                        if (options.caseSensitive) {
                            command += " --case-sensitive";
                        }
                        exec(command, { cwd: workspaceFolders[0].uri.fsPath }, (error, stdout, stderr) => {
                            if (error) {
                                panel.webview.postMessage({
                                    type: "error",
                                    message: `Rename failed: ${error.message}`
                                });
                            }
                            else {
                                panel.webview.postMessage({
                                    type: "renameComplete",
                                    data: { stdout, stderr }
                                });
                            }
                        });
                    }
                    catch (error) {
                        panel.webview.postMessage({
                            type: "error",
                            message: `Rename failed: ${error}`
                        });
                    }
                    break;
            }
        }, undefined, context.subscriptions);
    });
    context.subscriptions.push(cmd);
}
function getWebviewContent(webview) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Safe Rename Planner</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        h1 {
            color: var(--vscode-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        .section {
            margin-bottom: 30px;
            padding: 20px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            background-color: var(--vscode-editor-background);
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input, select {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
        }
        .checkbox-group {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
        }
        .checkbox-item {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            border-radius: 3px;
            cursor: pointer;
            margin-right: 10px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        button:disabled {
            background-color: var(--vscode-button-secondaryBackground);
            cursor: not-allowed;
        }
        .secondary {
            background-color: var(--vscode-button-secondaryBackground);
        }
        .results {
            margin-top: 20px;
        }
        .token-list {
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
            padding: 10px;
        }
        .token-item {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .token-item:last-child {
            border-bottom: none;
        }
        .output {
            background-color: var(--vscode-terminal-background);
            color: var(--vscode-terminal-foreground);
            padding: 15px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
            white-space: pre-wrap;
            overflow-x: auto;
        }
        .error {
            color: var(--vscode-errorForeground);
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            padding: 10px;
            border-radius: 3px;
            margin-top: 10px;
        }
        .success {
            color: var(--vscode-testing-iconPassed);
            background-color: var(--vscode-testing-passedBackground);
            border: 1px solid var(--vscode-testing-passedBorder);
            padding: 10px;
            border-radius: 3px;
            margin-top: 10px;
        }
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid var(--vscode-panel-border);
            border-radius: 50%;
            border-top-color: var(--vscode-button-background);
            animation: spin 1s ease-in-out infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Safe Rename Planner</h1>
        
        <div class="section">
            <h2>Repository Analysis</h2>
            <button onclick="analyzeRepository()">Analyze Repository</button>
            <div id="analysis-results" class="results"></div>
        </div>

        <div class="section">
            <h2>Rename Configuration</h2>
            <div class="form-group">
                <label for="old-name">Old Name:</label>
                <input type="text" id="old-name" placeholder="e.g., old-package, MyComponent" />
            </div>
            
            <div class="form-group">
                <label for="new-name">New Name:</label>
                <input type="text" id="new-name" placeholder="e.g., new-package, MyNewComponent" />
            </div>

            <div class="form-group">
                <label>Options:</label>
                <div class="checkbox-group">
                    <div class="checkbox-item">
                        <input type="checkbox" id="dry-run" checked />
                        <label for="dry-run">Dry Run (Preview)</label>
                    </div>
                    <div class="checkbox-item">
                        <input type="checkbox" id="update-package" />
                        <label for="update-package">Update package.json</label>
                    </div>
                    <div class="checkbox-item">
                        <input type="checkbox" id="update-remote" />
                        <label for="update-remote">Update Git Remote</label>
                    </div>
                    <div class="checkbox-item">
                        <input type="checkbox" id="case-sensitive" />
                        <label for="case-sensitive">Case Sensitive</label>
                    </div>
                </div>
            </div>

            <button onclick="executeRename()">Execute Rename</button>
            <button onclick="executeDryRun()" class="secondary">Dry Run</button>
            
            <div id="rename-results" class="results"></div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function analyzeRepository() {
            const resultsDiv = document.getElementById('analysis-results');
            resultsDiv.innerHTML = '<div class="loading"></div> Analyzing repository...';
            
            vscode.postMessage({
                command: 'analyzeRepo'
            });
        }

        function executeRename() {
            executeRenameOperation(false);
        }

        function executeDryRun() {
            executeRenameOperation(true);
        }

        function executeRenameOperation(dryRun) {
            const oldName = document.getElementById('old-name').value;
            const newName = document.getElementById('new-name').value;
            
            if (!oldName || !newName) {
                showError('Please enter both old and new names');
                return;
            }

            const options = {
                dryRun: dryRun || document.getElementById('dry-run').checked,
                updatePackage: document.getElementById('update-package').checked,
                updateRemote: document.getElementById('update-remote').checked,
                caseSensitive: document.getElementById('case-sensitive').checked
            };

            const resultsDiv = document.getElementById('rename-results');
            resultsDiv.innerHTML = '<div class="loading"></div> Executing rename...';
            
            vscode.postMessage({
                command: 'executeRename',
                data: { oldName, newName, options }
            });
        }

        function showError(message) {
            const resultsDiv = document.getElementById('rename-results');
            resultsDiv.innerHTML = \`<div class="error">\${message}</div>\`;
        }

        function showSuccess(message) {
            const resultsDiv = document.getElementById('rename-results');
            resultsDiv.innerHTML = \`<div class="success">\${message}</div>\`;
        }

        function showOutput(stdout, stderr) {
            const resultsDiv = document.getElementById('rename-results');
            let output = '';
            if (stdout) output += stdout;
            if (stderr) output += stderr;
            resultsDiv.innerHTML = \`<div class="output">\${output}</div>\`;
        }

        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'analysisComplete':
                    displayAnalysisResults(message.data);
                    break;
                case 'renameComplete':
                    showOutput(message.data.stdout, message.data.stderr);
                    break;
                case 'error':
                    showError(message.message);
                    break;
            }
        });

        function displayAnalysisResults(analysis) {
            const resultsDiv = document.getElementById('analysis-results');
            
            if (!analysis.topTokens || analysis.topTokens.length === 0) {
                resultsDiv.innerHTML = '<p>No significant tokens found in the repository.</p>';
                return;
            }

            let html = '<h3>Top Tokens (Potential Rename Candidates)</h3>';
            html += '<div class="token-list">';
            
            analysis.topTokens.forEach(([token, count]) => {
                html += \`
                    <div class="token-item">
                        <span>\${token}</span>
                        <span>\${count} occurrences</span>
                        <button onclick="selectToken('\${token}')">Use This</button>
                    </div>
                \`;
            });
            
            html += '</div>';
            resultsDiv.innerHTML = html;
        }

        function selectToken(token) {
            document.getElementById('old-name').value = token;
        }
    </script>
</body>
</html>`;
}
export function deactivate() { }
