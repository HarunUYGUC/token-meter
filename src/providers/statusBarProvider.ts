import * as vscode from 'vscode';
import { TokenizerService } from '../core/tokenizers/tokenizerService';
import { formatPercentage, formatTokenCount } from '../utils/formatters';

export class StatusBarProvider implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private tokenizerService: TokenizerService;
  private disposables: vscode.Disposable[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.tokenizerService = TokenizerService.getInstance();

    // Create status bar item on the right side with high priority
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'tokenMeter.selectModel';
    this.statusBarItem.name = 'Token Meter';

    this.registerEventListeners();
    this.updateStatusBar();
  }

  private registerEventListeners() {
    // Active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.updateStatusBar();
      })
    );

    // Selection changes (live selection token counter)
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection(() => {
        this.updateStatusBar();
      })
    );

    // Document edits (debounced calculation)
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(e => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document === e.document) {
          this.scheduleUpdate();
        }
      })
    );

    // Model switch changes
    this.disposables.push(
      this.tokenizerService.onDidChangeActiveModel(() => {
        this.updateStatusBar();
      })
    );
  }

  private scheduleUpdate() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    const config = vscode.workspace.getConfiguration('tokenMeter');
    const delay = config.get<number>('debounceDelay', 250);

    this.debounceTimer = setTimeout(() => {
      this.updateStatusBar();
    }, delay);
  }

  public updateStatusBar() {
    const config = vscode.workspace.getConfiguration('tokenMeter');
    const isEnabled = config.get<boolean>('statusBarEnabled', true);

    if (!isEnabled) {
      this.statusBarItem.hide();
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.statusBarItem.text = `$(symbol-keyword) Token Meter`;
      this.statusBarItem.tooltip = 'Open a file to view real-time token count.';
      this.statusBarItem.show();
      return;
    }

    const doc = editor.document;
    // Don't count output/log/git buffers
    if (doc.uri.scheme !== 'file' && doc.uri.scheme !== 'untitled') {
      this.statusBarItem.hide();
      return;
    }

    const fullText = doc.getText();
    const model = this.tokenizerService.getActiveModelMetadata();
    const totalTokens = this.tokenizerService.countTokens(fullText);

    const selection = editor.selection;
    const hasSelection = !selection.isEmpty;
    let selectionTokens = 0;

    if (hasSelection) {
      const selectedText = doc.getText(selection);
      selectionTokens = this.tokenizerService.countTokens(selectedText);
    }

    // Status Bar Text
    if (hasSelection) {
      this.statusBarItem.text = `$(symbol-keyword) ${formatTokenCount(selectionTokens)} / ${formatTokenCount(totalTokens)} (${model.name.split(' ')[0]})`;
    } else {
      this.statusBarItem.text = `$(symbol-keyword) ${formatTokenCount(totalTokens)} (${model.name.split(' ')[0]})`;
    }

    // Tooltip with Markdown Details
    const pct = totalTokens > 0 ? ((totalTokens / model.contextLimit) * 100).toFixed(2) : '0.00';
    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = true;
    tooltip.appendMarkdown(`### ⚡ Token Meter\n\n`);
    tooltip.appendMarkdown(`* **Model**: **${model.name}** (\`${model.vocabSize}\` vocab)\n`);
    tooltip.appendMarkdown(`* **File Tokens**: **${totalTokens.toLocaleString()}** (${formatTokenCount(totalTokens)})\n`);
    if (hasSelection) {
      tooltip.appendMarkdown(`* **Selection**: **${selectionTokens.toLocaleString()}** tokens (${formatPercentage(selectionTokens, totalTokens)})\n`);
    }
    tooltip.appendMarkdown(`* **Context Window Fill**: **${pct}%** of ${formatTokenCount(model.contextLimit)}\n\n`);
    tooltip.appendMarkdown(`---\n`);
    tooltip.appendMarkdown(`[$(gear) Switch Model](command:tokenMeter.selectModel) &nbsp;|&nbsp; [$(graph) Open Treemap](command:tokenMeter.openTreemap)`);

    this.statusBarItem.tooltip = tooltip;
    this.statusBarItem.show();
  }

  public dispose() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.statusBarItem.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
