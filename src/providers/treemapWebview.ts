import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FileScanner } from '../core/fileScanner';
import { TokenizerService } from '../core/tokenizers/tokenizerService';
import { SkillDetector } from '../core/skillDetector';

export class TreemapPanel {
  public static currentPanel: TreemapPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  private fileScanner: FileScanner;
  private tokenizerService: TokenizerService;
  private skillDetector: SkillDetector;

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (TreemapPanel.currentPanel) {
      TreemapPanel.currentPanel.panel.reveal(column);
      TreemapPanel.currentPanel.sendData();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'tokenMeterTreemap',
      'Token Meter: Context Treemap',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist'),
          vscode.Uri.joinPath(extensionUri, 'src', 'webview')
        ]
      }
    );

    TreemapPanel.currentPanel = new TreemapPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.fileScanner = FileScanner.getInstance();
    this.tokenizerService = TokenizerService.getInstance();
    this.skillDetector = SkillDetector.getInstance();

    this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.type) {
          case 'ready':
            await this.sendData();
            break;
          case 'openFile':
            if (message.path) {
              const doc = await vscode.workspace.openTextDocument(message.path);
              await vscode.window.showTextDocument(doc);
            }
            break;
          case 'selectModel':
            if (message.modelId) {
              this.tokenizerService.setActiveModel(message.modelId);
            }
            break;
          case 'refresh':
            this.skillDetector.clearCache();
            await this.fileScanner.scanWorkspace();
            await this.sendData();
            break;
        }
      },
      null,
      this.disposables
    );

    // Listen to workspace updates (including after model re-indexing)
    this.disposables.push(
      this.fileScanner.onDidUpdateWorkspace(() => {
        this.sendData();
      })
    );
  }

  public async sendData() {
    const hierarchy = this.fileScanner.getWorkspaceHierarchy('all');
    const activeModel = this.tokenizerService.getActiveModelMetadata();
    const allModels = this.tokenizerService.getAllModels();
    const totalTokens = hierarchy.reduce((sum, n) => sum + n.tokens, 0);
    const rules = this.fileScanner.getAIRulesList();
    const skills = await this.skillDetector.getSkillsForActiveModel();
    const totalSkillIndexTokens = skills.reduce((sum, s) => sum + s.indexTokens, 0);

    this.panel.webview.postMessage({
      type: 'updateData',
      payload: {
        hierarchy,
        activeModel,
        allModels,
        totalTokens,
        rules,
        skills,
        totalSkillIndexTokens
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'style.css')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
      <title>Token Meter Treemap</title>
      <link rel="stylesheet" href="${styleUri}">
    </head>
    <body>
      <div class="header-bar">
        <div class="title-group">
          <h2>Context Treemap</h2>
          <span class="badge-tag">Interactive</span>
        </div>
        <div class="controls-group">
          <input type="text" id="search-input" class="input-control" placeholder="Search file name..." />
          <select id="model-select" class="select-control"></select>
          <button id="simulator-toggle-btn" class="btn-primary" title="Open Prompt & Skill Budget Simulator">🎯 Prompt Simulator</button>
          <button id="refresh-btn" class="btn-icon" title="Rescan Workspace">⟳ Refresh</button>
        </div>
      </div>

      <!-- Prompt Simulator Drawer -->
      <div id="simulator-drawer" class="simulator-drawer collapsed">
        <div class="simulator-header">
          <div class="simulator-title">
            <strong>🎯 Prompt Simulator</strong>
            <span class="sim-badge" id="sim-ecosystem-badge">Ecosystem</span>
          </div>
          <div class="sim-summary">
            <span>Estimated Prompt: <strong id="sim-total-tokens">0</strong> tokens</span>
            <span id="sim-budget-pct">(0.0% of limit)</span>
            <button id="sim-close-btn" class="btn-icon-small">✕</button>
          </div>
        </div>

        <div class="simulator-content">
          <div class="sim-column">
            <h4>📜 AI Rules (<span id="sim-rules-tokens">0</span> tokens)</h4>
            <div id="sim-rules-list" class="sim-items-list"></div>
          </div>

          <div class="sim-column">
            <h4>🧠 AI Skills (<span id="sim-skills-tokens">0</span> tokens)</h4>
            <div id="sim-skills-list" class="sim-items-list"></div>
          </div>
        </div>
      </div>

      <div class="budget-meter-panel">
        <div class="meter-stats">
          <span>Workspace Context: <strong id="stat-total-tokens">0</strong> tokens</span>
          <div class="target-budget-group">
            <label for="budget-select">Target Budget:</label>
            <select id="budget-select" class="budget-select-control">
              <option value="auto">Auto (Model Max)</option>
              <option value="16000">16k (Free Tier / Strict)</option>
              <option value="32000">32k (Light / Budget)</option>
              <option value="64000">64k (Standard Task)</option>
              <option value="128000">128k (Full Module)</option>
              <option value="200000">200k (Claude 200k)</option>
              <option value="500000">500k (Large Project)</option>
              <option value="1000000">1M (Gemini Flash)</option>
              <option value="2000000">2M (Gemini Pro)</option>
              <option value="custom_action">✏️ Set Custom Limit...</option>
            </select>
            <button id="custom-budget-edit-btn" class="btn-icon-tiny btn-edit hidden" title="Edit Custom Budget">✏️</button>
            <input type="text" id="custom-budget-input" class="custom-budget-input hidden" placeholder="e.g. 50.000, 2M" />
            <button id="custom-budget-apply-btn" class="btn-icon-tiny hidden" title="Apply Custom Budget">✓</button>
          </div>
          <span>Budget Fill: <strong id="stat-fill-pct">0.0%</strong> <span class="model-cap-hint">(Model Max: <span id="stat-model-max">1M</span>)</span></span>
        </div>
        <div class="budget-track">
          <div id="budget-meter-fill" class="budget-fill"></div>
        </div>
      </div>

      <div class="sub-nav-bar">
        <div id="breadcrumbs" class="breadcrumbs-bar">
          <span class="breadcrumb-item active">Root</span>
        </div>

        <div class="legend-bar">
          <span class="legend-title">Token Scale:</span>
          <span class="legend-chip"><span class="chip-dot dot-green"></span> &lt; 1k (Light)</span>
          <span class="legend-chip"><span class="chip-dot dot-yellow"></span> 1k - 8k (Medium)</span>
          <span class="legend-chip"><span class="chip-dot dot-orange"></span> 8k - 30k (Heavy)</span>
          <span class="legend-chip"><span class="chip-dot dot-red"></span> &gt; 30k (Critical)</span>
          <span class="legend-chip"><span class="chip-dot dot-purple"></span> AI Rules</span>
          <div class="info-help" title="Color scale indicates token density. Large files (>30k) consume massive context and cause attention loss (Lost in the Middle) in AI models.">ℹ️ Info</div>
        </div>
      </div>

      <div id="treemap-container" class="treemap-viewport"></div>
      <div id="treemap-tooltip" class="treemap-tooltip"></div>

      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
  }

  public dispose() {
    TreemapPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
