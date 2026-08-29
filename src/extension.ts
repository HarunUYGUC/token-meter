import * as vscode from 'vscode';
import { TokenizerService } from './core/tokenizers/tokenizerService';
import { FileScanner } from './core/fileScanner';
import { CacheManager } from './core/cacheManager';
import { SkillDetector } from './core/skillDetector';
import { StatusBarProvider } from './providers/statusBarProvider';
import { TokenTreeProvider, AIRulesTreeProvider } from './providers/tokenTreeProvider';
import { TreemapPanel } from './providers/treemapWebview';
import { formatTokenCount } from './utils/formatters';

export function activate(context: vscode.ExtensionContext) {
  const tokenizerService = TokenizerService.getInstance();
  const cacheManager = CacheManager.getInstance();
  const fileScanner = FileScanner.getInstance();
  const skillDetector = SkillDetector.getInstance();

  // 1. Initialize Status Bar Provider
  const statusBarProvider = new StatusBarProvider();
  context.subscriptions.push(statusBarProvider);

  // 2. Initialize Tree View Providers
  const tokenTreeProvider = new TokenTreeProvider();
  const aiRulesTreeProvider = new AIRulesTreeProvider();

  const tokenTreeView = vscode.window.createTreeView('tokenMeterTree', {
    treeDataProvider: tokenTreeProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(tokenTreeView);

  const updateTreeDescription = () => {
    const total = fileScanner.getTotalWorkspaceTokens();
    tokenTreeView.description = total > 0 ? formatTokenCount(total) : undefined;
  };

  fileScanner.onDidUpdateWorkspace(() => {
    updateTreeDescription();
  });
  updateTreeDescription();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('tokenMeterRules', aiRulesTreeProvider)
  );

  // 3. Register Commands
  // Model Selector QuickPick
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenMeter.selectModel', async () => {
      const models = tokenizerService.getAllModels();
      const activeModelId = tokenizerService.getActiveModelId();

      const items: (vscode.QuickPickItem & { modelId: string })[] = models.map(m => ({
        label: `${m.id === activeModelId ? '$(check) ' : ''}${m.name}`,
        description: `Limit: ${formatTokenCount(m.contextLimit)} (${m.vocabSize} vocab)`,
        detail: m.description,
        modelId: m.id
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select active tokenizer model for token counting & context analysis',
        title: 'Token Meter: Select Tokenizer Model'
      });

      if (selected) {
        tokenizerService.setActiveModel(selected.modelId);
        vscode.window.setStatusBarMessage(
          `Token Meter: Switched to ${selected.label.replace('$(check) ', '')}`,
          3000
        );
      }
    })
  );

  // Open Interactive Treemap
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenMeter.openTreemap', () => {
      TreemapPanel.createOrShow(context.extensionUri);
    })
  );

  // Refresh Workspace
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenMeter.refreshWorkspace', async () => {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Token Meter: Analyzing workspace tokens...',
          cancellable: false
        },
        async () => {
          skillDetector.clearCache();
          await fileScanner.scanWorkspace();
          tokenTreeProvider.refresh();
          aiRulesTreeProvider.refresh();
        }
      );
    })
  );

  // Filter Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenMeter.filterAll', () => {
      tokenTreeProvider.setFilter('all');
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenMeter.filterRulesOnly', () => {
      tokenTreeProvider.setFilter('rules');
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenMeter.filterOpenTabsOnly', () => {
      tokenTreeProvider.setFilter('openTabs');
    })
  );

  // Open File
  context.subscriptions.push(
    vscode.commands.registerCommand('tokenMeter.openFile', async (uri: vscode.Uri) => {
      if (uri) {
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
      }
    })
  );

  // 4. File Watchers for Live Invalidation & Updates
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async doc => {
      if (doc.uri.scheme === 'file') {
        const activeModelId = tokenizerService.getActiveModelId();
        await fileScanner.indexFile(doc.uri.fsPath, activeModelId);
        tokenTreeProvider.refresh();
        aiRulesTreeProvider.refresh();
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidCreateFiles(async e => {
      const activeModelId = tokenizerService.getActiveModelId();
      for (const file of e.files) {
        await fileScanner.indexFile(file.fsPath, activeModelId);
      }
      tokenTreeProvider.refresh();
      aiRulesTreeProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidDeleteFiles(e => {
      for (const file of e.files) {
        cacheManager.invalidate(file.fsPath);
      }
      tokenTreeProvider.refresh();
      aiRulesTreeProvider.refresh();
    })
  );

  // 5. Initial Startup Scan
  fileScanner.scanWorkspace().then(() => {
    tokenTreeProvider.refresh();
    aiRulesTreeProvider.refresh();
  });
}

export function deactivate() {
  CacheManager.getInstance().clear();
}
