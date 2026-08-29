import * as vscode from 'vscode';
import * as path from 'path';
import { FileScanner, TokenNode } from '../core/fileScanner';
import { TokenizerService } from '../core/tokenizers/tokenizerService';
import { SkillDetector, SkillInfo, SkillFileItem } from '../core/skillDetector';
import { formatPercentage, formatTokenCount, formatBytes } from '../utils/formatters';

export class TokenTreeItem extends vscode.TreeItem {
  constructor(
    public readonly node: TokenNode,
    public readonly totalWorkspaceTokens: number,
    public readonly isRoot: boolean = false
  ) {
    super(
      node.name,
      node.isDirectory
        ? (isRoot ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed)
        : vscode.TreeItemCollapsibleState.None
    );

    this.description = this.buildDescription();
    this.tooltip = this.buildTooltip();
    this.iconPath = this.getIcon();
    this.contextValue = isRoot ? 'rootDirectory' : (node.isDirectory ? 'directory' : 'file');

    if (!node.isDirectory) {
      this.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [vscode.Uri.file(node.absolutePath)]
      };
    }
  }

  private buildDescription(): string {
    const formattedTokens = formatTokenCount(this.node.tokens);
    if (this.isRoot) {
      return formattedTokens;
    }
    if (this.totalWorkspaceTokens > 0 && this.node.tokens > 0) {
      const pct = formatPercentage(this.node.tokens, this.totalWorkspaceTokens);
      return `${formattedTokens} (${pct})`;
    }
    return formattedTokens;
  }

  private buildTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.appendMarkdown(`### ${this.isRoot ? '🗂️ ' : (this.node.isDirectory ? '📁 ' : '📄 ')} **${this.node.name}**\n\n`);
    md.appendMarkdown(`* **Path**: \`${this.node.relativePath || '.'}\`\n`);
    md.appendMarkdown(`* **Tokens**: **${this.node.tokens.toLocaleString()}** (${formatTokenCount(this.node.tokens)})\n`);
    md.appendMarkdown(`* **Disk Size**: ${formatBytes(this.node.size)}\n`);

    if (this.isRoot) {
      md.appendMarkdown(`* **Scope**: Workspace Root Folder\n`);
    } else if (this.totalWorkspaceTokens > 0) {
      const pct = ((this.node.tokens / this.totalWorkspaceTokens) * 100).toFixed(1);
      md.appendMarkdown(`* **Workspace Ratio**: \`${pct}%\`\n`);
    }

    if (this.node.isRule && this.node.ruleInfo) {
      md.appendMarkdown(`* **AI Rule**: \`${this.node.ruleInfo.toolName}\` (${this.node.ruleInfo.description})\n`);
    }

    return md;
  }

  private getIcon(): vscode.ThemeIcon {
    if (this.isRoot) {
      return new vscode.ThemeIcon('root-folder', new vscode.ThemeColor('charts.blue'));
    }
    if (this.node.isDirectory) {
      return new vscode.ThemeIcon('folder');
    }
    if (this.node.isRule) {
      return new vscode.ThemeIcon('verified', new vscode.ThemeColor('charts.purple'));
    }
    return new vscode.ThemeIcon('file-code');
  }
}

export class TokenTreeProvider implements vscode.TreeDataProvider<TokenNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TokenNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private fileScanner: FileScanner;
  private tokenizerService: TokenizerService;
  private currentFilter: 'all' | 'rules' | 'openTabs' = 'all';

  constructor() {
    this.fileScanner = FileScanner.getInstance();
    this.tokenizerService = TokenizerService.getInstance();

    this.fileScanner.onDidUpdateWorkspace(() => {
      this.refresh();
    });

    this.tokenizerService.onDidChangeActiveModel(() => {
      this.refresh();
    });
  }

  public setFilter(filter: 'all' | 'rules' | 'openTabs') {
    this.currentFilter = filter;
    this.refresh();
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TokenNode): vscode.TreeItem {
    const totalTokens = this.getTotalWorkspaceTokens();
    const isRoot = element.relativePath === '';
    return new TokenTreeItem(element, totalTokens, isRoot);
  }

  getChildren(element?: TokenNode): Thenable<TokenNode[]> {
    if (element) {
      return Promise.resolve(element.children || []);
    }

    const hierarchy = this.fileScanner.getWorkspaceHierarchy(this.currentFilter);
    return Promise.resolve(hierarchy);
  }

  private getTotalWorkspaceTokens(): number {
    return this.fileScanner.getTotalWorkspaceTokens();
  }
}

export interface AIRuleTreeElement {
  id?: string;
  type: 'section' | 'rule' | 'skill' | 'skillFile' | 'emptyNotice' | 'hint' | 'header';
  label: string;
  description?: string;
  tooltip?: string | vscode.MarkdownString;
  icon?: vscode.ThemeIcon;
  collapsibleState?: vscode.TreeItemCollapsibleState;
  node?: TokenNode;
  skill?: SkillInfo;
  skillFile?: SkillFileItem;
  children?: AIRuleTreeElement[];
}

/**
 * Dedicated Tree Provider for AI Rules & AI Skills Panel
 */
export class AIRulesTreeProvider implements vscode.TreeDataProvider<AIRuleTreeElement> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AIRuleTreeElement | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private fileScanner: FileScanner;
  private tokenizerService: TokenizerService;
  private skillDetector: SkillDetector;

  constructor() {
    this.fileScanner = FileScanner.getInstance();
    this.tokenizerService = TokenizerService.getInstance();
    this.skillDetector = SkillDetector.getInstance();

    this.fileScanner.onDidUpdateWorkspace(() => {
      this.refresh();
    });
    this.tokenizerService.onDidChangeActiveModel(() => {
      this.refresh();
    });
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AIRuleTreeElement): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.label,
      element.collapsibleState ?? vscode.TreeItemCollapsibleState.None
    );
    item.description = element.description;
    item.tooltip = element.tooltip;
    item.iconPath = element.icon;

    if (element.node) {
      item.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [vscode.Uri.file(element.node.absolutePath)]
      };
    } else if (element.skill) {
      item.command = {
        command: 'vscode.open',
        title: 'Open SKILL.md',
        arguments: [vscode.Uri.file(element.skill.skillMdPath)]
      };
    } else if (element.skillFile) {
      item.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [vscode.Uri.file(element.skillFile.absolutePath)]
      };
    }

    return item;
  }

  async getChildren(element?: AIRuleTreeElement): Promise<AIRuleTreeElement[]> {
    const model = this.tokenizerService.getActiveModelMetadata();

    // 1. Root level: Show Sections (AI Rules & AI Skills)
    if (!element) {
      const rules = this.fileScanner.getAIRulesList();
      const skills = await this.skillDetector.getSkillsForActiveModel();
      const totalIndexTokens = skills.reduce((sum, s) => sum + s.indexTokens, 0);
      const totalRuleTokens = rules.reduce((sum, r) => sum + r.tokens, 0);

      const rulesSection: AIRuleTreeElement = {
        type: 'section',
        label: 'AI Rules',
        description: rules.length > 0 ? `${formatTokenCount(totalRuleTokens)} baseline` : '(0 rules)',
        icon: new vscode.ThemeIcon('verified', new vscode.ThemeColor('charts.purple')),
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        tooltip: 'Fixed system rules sent on every prompt turn.'
      };

      const skillsSection: AIRuleTreeElement = {
        type: 'section',
        label: `AI Skills (${model.name.split(' ')[0]})`,
        description: `${skills.length} skills (${formatTokenCount(totalIndexTokens)} index)`,
        icon: new vscode.ThemeIcon('sparkle', new vscode.ThemeColor('charts.blue')),
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        tooltip: `Skills available for ${model.name}. Index tokens are loaded into system prompt; full content is loaded only on demand.`
      };

      return [rulesSection, skillsSection];
    }

    // 2. Rules Section Children
    if (element.type === 'section' && element.label.startsWith('AI Rules')) {
      const rules = this.fileScanner.getAIRulesList();

      if (rules.length === 0) {
        const emptyNotice: AIRuleTreeElement = {
          type: 'emptyNotice',
          label: 'No AI Rules in Workspace',
          description: '(0 baseline tokens)',
          icon: new vscode.ThemeIcon('info', new vscode.ThemeColor('descriptionForeground')),
          tooltip: new vscode.MarkdownString(
            `### 🤖 What is Baseline Overhead?\n\n` +
            `AI coding assistants (Cursor, Gemini, Windsurf, Copilot, Cline) automatically inject rule files into **every single prompt turn** before any code is added.\n\n` +
            `**Supported Rule Files:**\n` +
            `* \`.cursorrules\` or \`.cursor/rules/*.mdc\` (Cursor)\n` +
            `* \`GEMINI.md\` or \`.gemini/rules/*\` (Antigravity/Gemini)\n` +
            `* \`.windsurfrules\` (Windsurf)\n` +
            `* \`.clinerules\` or \`.roomodes\` (Cline / Roo Code)\n` +
            `* \`.github/copilot-instructions.md\` (Copilot)`
          )
        };

        const hint1: AIRuleTreeElement = {
          type: 'hint',
          label: 'Supported: .cursorrules, GEMINI.md',
          description: 'Windsurf, Copilot, Cline',
          icon: new vscode.ThemeIcon('sparkle', new vscode.ThemeColor('charts.purple')),
          tooltip: 'Add any of these rule files to the root of your project to automatically track its fixed token cost.'
        };

        return [emptyNotice, hint1];
      }

      const totalBaselineTokens = rules.reduce((sum, r) => sum + r.tokens, 0);
      const headerItem: AIRuleTreeElement = {
        type: 'header',
        label: `Total Baseline Overhead`,
        description: `${formatTokenCount(totalBaselineTokens)} / turn`,
        icon: new vscode.ThemeIcon('dashboard', new vscode.ThemeColor('charts.purple')),
        tooltip: new vscode.MarkdownString(
          `### ⚡ Fixed Baseline Cost\n\n` +
          `* Total: **${totalBaselineTokens.toLocaleString()} tokens** (${formatTokenCount(totalBaselineTokens)})\n` +
          `* Active Model: **${model.name}**\n\n` +
          `*This fixed cost is charged on **every prompt request** in this workspace.*`
        )
      };

      const ruleItems: AIRuleTreeElement[] = rules.map(rule => ({
        type: 'rule',
        node: rule,
        label: rule.name,
        description: `${formatTokenCount(rule.tokens)} (${rule.ruleInfo?.toolName || 'AI Rule'})`,
        icon: new vscode.ThemeIcon('verified', new vscode.ThemeColor('charts.purple')),
        tooltip: new vscode.MarkdownString(
          `### 🤖 **${rule.ruleInfo?.toolName || 'AI Rule'}**\n\n` +
          `* **File**: \`${rule.relativePath}\`\n` +
          `* **Tokens**: **${rule.tokens.toLocaleString()} tokens** (${model.name})\n` +
          `* **Description**: *${rule.ruleInfo?.description || 'AI Rule File'}*\n\n` +
          `*Click to open and edit this rule file.*`
        )
      }));

      return [headerItem, ...ruleItems];
    }

    // 3. Skills Section Children
    if (element.type === 'section' && element.label.startsWith('AI Skills')) {
      const skills = await this.skillDetector.getSkillsForActiveModel();

      if (skills.length === 0) {
        return [{
          type: 'emptyNotice',
          label: 'No skills found for this ecosystem',
          description: `(${model.family})`,
          icon: new vscode.ThemeIcon('info'),
          tooltip: `No skills detected in workspace or global paths for ${model.name}.`
        }];
      }

      return skills.map(skill => {
        const hasSubFiles = skill.files.length > 1;
        return {
          type: 'skill',
          skill,
          label: skill.name,
          description: hasSubFiles
            ? `Core: ${formatTokenCount(skill.coreTokens)} | Bundle: ${formatTokenCount(skill.bundleTokens)}`
            : `${formatTokenCount(skill.coreTokens)} tokens`,
          icon: new vscode.ThemeIcon('tools', new vscode.ThemeColor('charts.blue')),
          collapsibleState: hasSubFiles
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None,
          tooltip: new vscode.MarkdownString(
            `### 🧠 **Skill: ${skill.name}**\n\n` +
            `*${skill.description}*\n\n` +
            `---\n` +
            `* **Index Cost (System Prompt)**: ~**${skill.indexTokens} tokens** (loaded always)\n` +
            `* **Core Entry (SKILL.md)**: **${skill.coreTokens.toLocaleString()} tokens** (${formatTokenCount(skill.coreTokens)})\n` +
            (hasSubFiles ? `* **Full Bundle (${skill.files.length} files)**: **${skill.bundleTokens.toLocaleString()} tokens** (${formatTokenCount(skill.bundleTokens)})\n` : '') +
            `* **Scope**: \`${skill.scope}\` | **Ecosystem**: \`${skill.ecosystem}\`\n` +
            `* **Location**: \`${skill.directoryPath}\`\n\n` +
            `*Click to view SKILL.md in editor.*`
          )
        };
      });
    }

    // 4. Skill Files Drilldown (for multi-file skills like ui-ux-pro-max)
    if (element.type === 'skill' && element.skill && element.skill.files.length > 0) {
      return element.skill.files.map(file => ({
        type: 'skillFile',
        skillFile: file,
        label: file.relativePath,
        description: `${formatTokenCount(file.tokens)} (${formatBytes(file.size)})`,
        icon: new vscode.ThemeIcon(file.name.endsWith('.md') ? 'markdown' : 'file-code'),
        tooltip: new vscode.MarkdownString(
          `### 📄 **${file.relativePath}**\n\n` +
          `* **Tokens**: **${file.tokens.toLocaleString()} tokens**\n` +
          `* **Disk Size**: ${formatBytes(file.size)}\n` +
          `* **Path**: \`${file.absolutePath}\`\n\n` +
          `*Click to open in editor.*`
        )
      }));
    }

    return [];
  }
}
