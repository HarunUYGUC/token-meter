import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
let vscode: any;
try {
  vscode = require('vscode');
} catch {}
import { TokenizerService } from './tokenizers/tokenizerService';
import { BINARY_EXTENSIONS } from '../constants';

export interface SkillFileItem {
  name: string;
  relativePath: string;
  absolutePath: string;
  tokens: number;
  size: number;
}

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  ecosystem: 'google' | 'anthropic' | 'openai' | 'generic';
  scope: 'builtin' | 'global' | 'workspace';
  directoryPath: string;
  skillMdPath: string;
  indexTokens: number;   // Frontmatter name + description (tokens spent in system prompt menu)
  coreTokens: number;    // SKILL.md body (tokens spent on initial skill invocation)
  bundleTokens: number;  // Total tokens of all files in the skill directory
  files: SkillFileItem[];
}

interface SkillCacheEntry {
  mtimes: Map<string, number>;
  skills: SkillInfo[];
}

export class SkillDetector {
  private static instance: SkillDetector;
  private tokenizerService: TokenizerService;
  private memoryCache: Map<string, SkillCacheEntry> = new Map(); // Keyed by modelId

  private constructor() {
    this.tokenizerService = TokenizerService.getInstance();
  }

  public static getInstance(): SkillDetector {
    if (!SkillDetector.instance) {
      SkillDetector.instance = new SkillDetector();
    }
    return SkillDetector.instance;
  }

  /**
   * Clears the in-memory skill cache (e.g. on manual refresh)
   */
  public clearCache(): void {
    this.memoryCache.clear();
  }

  /**
   * Discovers and parses all skills relevant to the active model's ecosystem with fast RAM caching
   */
  public async getSkillsForActiveModel(): Promise<SkillInfo[]> {
    const activeModel = this.tokenizerService.getActiveModelMetadata();
    const modelId = activeModel.id;
    const ecosystem = activeModel.family; // 'google' | 'anthropic' | 'openai' | 'deepseek'

    const searchDirs = this.getSkillSearchPaths(ecosystem);

    // 1. Fast Cache Check: If cached and directory mtimes match, return instantly (0ms)
    const cached = this.memoryCache.get(modelId);
    if (cached) {
      let isUpToDate = true;
      for (const dirEntry of searchDirs) {
        const exists = fs.existsSync(dirEntry.path);
        const wasCached = cached.mtimes.has(dirEntry.path);

        if (!exists) {
          if (wasCached) {
            isUpToDate = false;
            break;
          }
          continue;
        }

        try {
          const stat = fs.statSync(dirEntry.path);
          const prevMtime = cached.mtimes.get(dirEntry.path);
          if (prevMtime === undefined || stat.mtimeMs !== prevMtime) {
            isUpToDate = false;
            break;
          }
        } catch {
          isUpToDate = false;
          break;
        }
      }

      if (isUpToDate) {
        return cached.skills;
      }
    }

    // 2. Cache Miss or Invalidation: Perform disk scan & record directory mtimes
    const currentMtimes = new Map<string, number>();
    const skills: SkillInfo[] = [];

    for (const dirEntry of searchDirs) {
      if (!fs.existsSync(dirEntry.path)) {
        continue;
      }
      try {
        const stat = fs.statSync(dirEntry.path);
        currentMtimes.set(dirEntry.path, stat.mtimeMs);
        const found = await this.scanSkillsDirectory(dirEntry.path, dirEntry.scope, dirEntry.ecosystem, modelId);
        skills.push(...found);
      } catch (err) {
        console.warn(`Token Meter: Failed scanning skills in ${dirEntry.path}`, err);
      }
    }

    // Deduplicate skills by id / directoryPath
    const uniqueMap = new Map<string, SkillInfo>();
    for (const s of skills) {
      if (!uniqueMap.has(s.id)) {
        uniqueMap.set(s.id, s);
      }
    }

    const result = Array.from(uniqueMap.values()).sort((a, b) => b.coreTokens - a.coreTokens);
    this.memoryCache.set(modelId, { mtimes: currentMtimes, skills: result });
    return result;
  }

  /**
   * Returns total index tokens (the fixed prompt cost of all available skill descriptions in system prompt)
   */
  public async getTotalSkillIndexTokens(): Promise<number> {
    const skills = await this.getSkillsForActiveModel();
    return skills.reduce((sum, s) => sum + s.indexTokens, 0);
  }

  /**
   * Determines the directories to search based on the active ecosystem
   */
  private getSkillSearchPaths(ecosystem: string): Array<{ path: string; scope: 'builtin' | 'global' | 'workspace'; ecosystem: 'google' | 'anthropic' | 'generic' }> {
    const homedir = os.homedir();
    const paths: Array<{ path: string; scope: 'builtin' | 'global' | 'workspace'; ecosystem: 'google' | 'anthropic' | 'generic' }> = [];

    // 1. Workspace Project-Level Skills (always scanned)
    try {
      if (typeof vscode !== 'undefined' && vscode.workspace && vscode.workspace.workspaceFolders) {
        for (const folder of vscode.workspace.workspaceFolders) {
          const root = folder.uri.fsPath;
          paths.push({ path: path.join(root, '.skills'), scope: 'workspace', ecosystem: 'generic' });
          paths.push({ path: path.join(root, 'skills'), scope: 'workspace', ecosystem: 'generic' });

          if (ecosystem === 'google') {
            paths.push({ path: path.join(root, '.gemini', 'skills'), scope: 'workspace', ecosystem: 'google' });
          } else if (ecosystem === 'anthropic') {
            paths.push({ path: path.join(root, '.claude', 'skills'), scope: 'workspace', ecosystem: 'anthropic' });
          }
        }
      }
    } catch {}

    // 2. Global Ecosystem-Specific Skills
    if (ecosystem === 'google') {
      // Gemini / Antigravity Built-in Skills
      paths.push({
        path: path.join(homedir, '.gemini', 'antigravity', 'builtin', 'skills'),
        scope: 'builtin',
        ecosystem: 'google'
      });
      // Gemini / Antigravity Config Skills
      paths.push({
        path: path.join(homedir, '.gemini', 'config', 'skills'),
        scope: 'global',
        ecosystem: 'google'
      });
      // Gemini Plugin Skills
      const pluginDir = path.join(homedir, '.gemini', 'config', 'plugins');
      if (fs.existsSync(pluginDir)) {
        try {
          const plugins = fs.readdirSync(pluginDir, { withFileTypes: true });
          for (const p of plugins) {
            if (p.isDirectory()) {
              paths.push({
                path: path.join(pluginDir, p.name, 'skills'),
                scope: 'global',
                ecosystem: 'google'
              });
            }
          }
        } catch {}
      }
    } else if (ecosystem === 'anthropic') {
      // Claude Code Global Skills
      paths.push({
        path: path.join(homedir, '.claude', 'skills'),
        scope: 'global',
        ecosystem: 'anthropic'
      });
      paths.push({
        path: path.join(homedir, '.config', 'claude', 'skills'),
        scope: 'global',
        ecosystem: 'anthropic'
      });
    }

    return paths;
  }

  /**
   * Scans a parent directory containing skill subfolders (e.g. skills/chrome-extensions/SKILL.md)
   */
  private async scanSkillsDirectory(
    parentDir: string,
    scope: 'builtin' | 'global' | 'workspace',
    ecosystem: 'google' | 'anthropic' | 'generic',
    modelId: string
  ): Promise<SkillInfo[]> {
    const results: SkillInfo[] = [];
    const entries = await fs.promises.readdir(parentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const skillDir = path.join(parentDir, entry.name);
      const skillMd = path.join(skillDir, 'SKILL.md');

      if (fs.existsSync(skillMd)) {
        const skill = await this.parseSkillDirectory(skillDir, skillMd, entry.name, scope, ecosystem, modelId);
        if (skill) {
          results.push(skill);
        }
      }
    }

    return results;
  }

  /**
   * Analyzes an individual skill directory, its SKILL.md, and all supplementary data/scripts
   */
  public async parseSkillDirectory(
    skillDir: string,
    skillMdPath: string,
    dirName: string,
    scope: 'builtin' | 'global' | 'workspace',
    ecosystem: 'google' | 'anthropic' | 'generic',
    modelId: string
  ): Promise<SkillInfo | null> {
    try {
      const skillMdContent = await fs.promises.readFile(skillMdPath, 'utf8');

      // 1. Parse frontmatter (YAML block between --- and ---)
      const { name, description } = this.extractFrontmatter(skillMdContent, dirName);

      // 2. Calculate Index Token Cost (what's injected in the model's system prompt)
      const indexSummaryText = `${name}: ${description}`;
      const indexTokens = this.tokenizerService.countTokens(indexSummaryText, modelId);

      // 3. Calculate Core Token Cost (SKILL.md body itself)
      const coreTokens = this.tokenizerService.countTokens(skillMdContent, modelId);

      // 4. Calculate Bundle Token Cost by traversing all files in the skill directory
      const allFiles = await this.collectSkillFiles(skillDir, skillDir, modelId);
      const bundleTokens = allFiles.reduce((sum, f) => sum + f.tokens, 0);

      return {
        id: dirName,
        name: name || dirName,
        description: description || 'Custom AI Skill',
        ecosystem,
        scope,
        directoryPath: skillDir,
        skillMdPath,
        indexTokens,
        coreTokens,
        bundleTokens,
        files: allFiles.sort((a, b) => b.tokens - a.tokens)
      };
    } catch (err) {
      console.warn(`Token Meter: Error parsing skill at ${skillDir}`, err);
      return null;
    }
  }

  /**
   * Recursively collects all text files within a skill folder and calculates their token counts
   */
  private async collectSkillFiles(rootDir: string, currentDir: string, modelId: string): Promise<SkillFileItem[]> {
    const items: SkillFileItem[] = [];
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        const subItems = await this.collectSkillFiles(rootDir, fullPath, modelId);
        items.push(...subItems);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).slice(1).toLowerCase();
        if (BINARY_EXTENSIONS.has(ext)) {
          continue;
        }

        try {
          const stats = await fs.promises.stat(fullPath);
          if (stats.size > 2 * 1024 * 1024) continue; // Skip huge binary files

          const content = await fs.promises.readFile(fullPath, 'utf8');
          const tokens = this.tokenizerService.countTokens(content, modelId);
          const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

          items.push({
            name: entry.name,
            relativePath: relPath,
            absolutePath: fullPath,
            tokens,
            size: stats.size
          });
        } catch {}
      }
    }

    return items;
  }

  /**
   * Helper to parse YAML frontmatter name and description
   */
  private extractFrontmatter(content: string, fallbackName: string): { name: string; description: string } {
    let name = fallbackName;
    let description = '';

    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (frontmatterMatch) {
      const yaml = frontmatterMatch[1];
      const nameMatch = yaml.match(/^name:\s*(.+)$/m);
      const descMatch = yaml.match(/^description:\s*(.+)$/m);

      if (nameMatch) name = nameMatch[1].trim().replace(/^['"]|['"]$/g, '');
      if (descMatch) description = descMatch[1].trim().replace(/^['"]|['"]$/g, '');
    }

    return { name, description };
  }
}
