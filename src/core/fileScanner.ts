import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TokenizerService } from './tokenizers/tokenizerService';
import { CacheManager } from './cacheManager';
import { RuleDetector, AIRuleInfo } from './ruleDetector';
import { BINARY_EXTENSIONS, DEFAULT_EXCLUDES } from '../constants';

export interface TokenNode {
  name: string;
  relativePath: string;
  absolutePath: string;
  isDirectory: boolean;
  size: number;
  tokens: number;
  isRule: boolean;
  isOpenTab?: boolean;
  ruleInfo?: AIRuleInfo | null;
  children?: TokenNode[];
}

export class FileScanner {
  private static instance: FileScanner;
  private tokenizerService: TokenizerService;
  private cacheManager: CacheManager;
  private isScanning: boolean = false;

  private _onDidUpdateWorkspace = new vscode.EventEmitter<void>();
  readonly onDidUpdateWorkspace = this._onDidUpdateWorkspace.event;

  private constructor() {
    this.tokenizerService = TokenizerService.getInstance();
    this.cacheManager = CacheManager.getInstance();

    // Re-calculate workspace tokens when model changes
    this.tokenizerService.onDidChangeActiveModel(async () => {
      await this.recomputeAllCachedTokens();
      this._onDidUpdateWorkspace.fire();
    });
  }

  public static getInstance(): FileScanner {
    if (!FileScanner.instance) {
      FileScanner.instance = new FileScanner();
    }
    return FileScanner.instance;
  }

  public isScanInProgress(): boolean {
    return this.isScanning;
  }

  /**
   * Scans all workspace folders and indexes their token counts
   */
  public async scanWorkspace(): Promise<void> {
    if (this.isScanning) {
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    this.isScanning = true;

    try {
      const config = vscode.workspace.getConfiguration('tokenMeter');
      const customExcludes = config.get<string[]>('excludePatterns', []);
      const excludes = Array.from(new Set([...DEFAULT_EXCLUDES, ...customExcludes]));
      const excludePattern = `{${excludes.join(',')}}`;

      const files = await vscode.workspace.findFiles('**/*', excludePattern);
      const activeModelId = this.tokenizerService.getActiveModelId();

      for (const uri of files) {
        await this.indexFile(uri.fsPath, activeModelId);
      }

      this._onDidUpdateWorkspace.fire();
    } catch (err) {
      console.error('Token Meter: Error during workspace scan', err);
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Indexes a single file path, using cache if mtime is unchanged
   */
  public async indexFile(filePath: string, modelId: string): Promise<number> {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) {
      return 0;
    }

    try {
      const stats = await fs.promises.stat(filePath);
      if (stats.isDirectory()) {
        return 0;
      }

      // Skip files larger than 5 MB to prevent freezing
      if (stats.size > 5 * 1024 * 1024) {
        return 0;
      }

      const cached = this.cacheManager.get(filePath, stats.mtimeMs, modelId);
      if (cached !== undefined) {
        return cached;
      }

      const content = await fs.promises.readFile(filePath, 'utf8');
      const tokens = this.tokenizerService.countTokens(content, modelId);
      this.cacheManager.set(filePath, stats.mtimeMs, stats.size, modelId, tokens);
      return tokens;
    } catch {
      return 0;
    }
  }

  /**
   * Recomputes token counts for all cached files under the new active model
   */
  public async recomputeAllCachedTokens(): Promise<void> {
    const activeModelId = this.tokenizerService.getActiveModelId();
    const entries = this.cacheManager.getAllEntries();

    for (const entry of entries) {
      if (entry.tokensByModel[activeModelId] === undefined) {
        await this.indexFile(entry.filePath, activeModelId);
      }
    }
  }

  /**
   * Builds a hierarchical tree structure of the workspace for TreeView and Treemap
   */
  public getWorkspaceHierarchy(filter: 'all' | 'rules' | 'openTabs' = 'all'): TokenNode[] {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [];
    }

    const activeModelId = this.tokenizerService.getActiveModelId();
    const openTabPaths = new Set(
      vscode.window.visibleTextEditors.map(editor => editor.document.uri.fsPath)
    );

    const rootNodes: TokenNode[] = [];

    for (const folder of workspaceFolders) {
      const rootPath = folder.uri.fsPath;
      const folderName = folder.name;
      const rootNode: TokenNode = {
        name: folderName,
        relativePath: '',
        absolutePath: rootPath,
        isDirectory: true,
        size: 0,
        tokens: 0,
        isRule: false,
        children: []
      };

      const cachedEntries = this.cacheManager.getAllEntries().filter(e =>
        e.filePath.startsWith(rootPath)
      );

      for (const entry of cachedEntries) {
        const relPath = path.relative(rootPath, entry.filePath).replace(/\\/g, '/');
        const isRule = RuleDetector.isRuleFile(relPath);
        const isOpen = openTabPaths.has(entry.filePath);

        if (filter === 'rules' && !isRule) continue;
        if (filter === 'openTabs' && !isOpen) continue;

        const tokens = entry.tokensByModel[activeModelId] || 0;
        const ruleInfo = isRule ? RuleDetector.getRuleInfo(relPath) : null;

        this.insertPathIntoHierarchy(rootNode, relPath, entry.filePath, entry.size, tokens, isRule, isOpen, ruleInfo);
      }

      this.aggregateNodeTokens(rootNode);
      this.sortNodeChildren(rootNode);
      rootNodes.push(rootNode);
    }

    return rootNodes;
  }

  /**
   * Returns a flat list of all AI Rule files in the workspace
   */
  public getAIRulesList(): TokenNode[] {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [];
    }

    const activeModelId = this.tokenizerService.getActiveModelId();
    const rules: TokenNode[] = [];

    for (const folder of workspaceFolders) {
      const rootPath = folder.uri.fsPath;
      const entries = this.cacheManager.getAllEntries().filter(e => e.filePath.startsWith(rootPath));

      for (const entry of entries) {
        const relPath = path.relative(rootPath, entry.filePath).replace(/\\/g, '/');
        if (RuleDetector.isRuleFile(relPath)) {
          const tokens = entry.tokensByModel[activeModelId] || 0;
          rules.push({
            name: path.basename(entry.filePath),
            relativePath: relPath,
            absolutePath: entry.filePath,
            isDirectory: false,
            size: entry.size,
            tokens,
            isRule: true,
            ruleInfo: RuleDetector.getRuleInfo(relPath)
          });
        }
      }
    }

    return rules.sort((a, b) => b.tokens - a.tokens);
  }

  private insertPathIntoHierarchy(
    root: TokenNode,
    relPath: string,
    absPath: string,
    size: number,
    tokens: number,
    isRule: boolean,
    isOpenTab: boolean,
    ruleInfo: AIRuleInfo | null
  ) {
    const parts = relPath.split('/');
    let current = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      let dirNode = current.children?.find(c => c.isDirectory && c.name === part);
      if (!dirNode) {
        const dirRelPath = parts.slice(0, i + 1).join('/');
        dirNode = {
          name: part,
          relativePath: dirRelPath,
          absolutePath: path.join(root.absolutePath, dirRelPath),
          isDirectory: true,
          size: 0,
          tokens: 0,
          isRule: false,
          children: []
        };
        current.children?.push(dirNode);
      }
      current = dirNode;
    }

    const fileName = parts[parts.length - 1];
    current.children?.push({
      name: fileName,
      relativePath: relPath,
      absolutePath: absPath,
      isDirectory: false,
      size,
      tokens,
      isRule,
      isOpenTab,
      ruleInfo
    });
  }

  private aggregateNodeTokens(node: TokenNode): { tokens: number; size: number } {
    if (!node.isDirectory) {
      return { tokens: node.tokens, size: node.size };
    }

    let totalTokens = 0;
    let totalSize = 0;

    if (node.children) {
      for (const child of node.children) {
        const res = this.aggregateNodeTokens(child);
        totalTokens += res.tokens;
        totalSize += res.size;
      }
    }

    node.tokens = totalTokens;
    node.size = totalSize;
    return { tokens: totalTokens, size: totalSize };
  }

  private sortNodeChildren(node: TokenNode) {
    if (!node.children || node.children.length === 0) {
      return;
    }

    // Sort folders first or sort purely by token count descending
    node.children.sort((a, b) => b.tokens - a.tokens);

    for (const child of node.children) {
      if (child.isDirectory) {
        this.sortNodeChildren(child);
      }
    }
  }

  public getTotalWorkspaceTokens(): number {
    const hierarchy = this.getWorkspaceHierarchy('all');
    return hierarchy.reduce((sum, node) => sum + node.tokens, 0);
  }
}
