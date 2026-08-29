import * as path from 'path';

export interface AIRuleInfo {
  toolName: string;
  category: 'cursor' | 'gemini' | 'windsurf' | 'cline' | 'copilot' | 'custom';
  description: string;
  icon: string;
}

export class RuleDetector {
  /**
   * Checks if a relative or absolute file path matches any known AI assistant rule file
   */
  public static isRuleFile(filePath: string): boolean {
    return this.getRuleInfo(filePath) !== null;
  }

  /**
   * Identifies the AI coding tool associated with the given rule file
   */
  public static getRuleInfo(filePath: string): AIRuleInfo | null {
    const normalized = filePath.replace(/\\/g, '/');
    const fileName = path.basename(normalized);

    // Cursor
    if (fileName === '.cursorrules') {
      return {
        toolName: 'Cursor Rules',
        category: 'cursor',
        description: 'Root system instruction file for Cursor IDE',
        icon: '$(symbol-event)'
      };
    }
    if (normalized.includes('/.cursor/rules/') || normalized.startsWith('.cursor/rules/')) {
      return {
        toolName: 'Cursor Rule',
        category: 'cursor',
        description: 'Modular Cursor prompt rule',
        icon: '$(symbol-event)'
      };
    }

    // Windsurf
    if (fileName === '.windsurfrules') {
      return {
        toolName: 'Windsurf Rules',
        category: 'windsurf',
        description: 'System instructions for Codeium Windsurf Cascade',
        icon: '$(symbol-event)'
      };
    }

    // Cline / Roo-Code
    if (fileName === '.clinerules' || normalized.includes('/.clinerules/') || normalized.startsWith('.clinerules/')) {
      return {
        toolName: 'Cline Rules',
        category: 'cline',
        description: 'System instructions for Cline AI agent',
        icon: '$(robot)'
      };
    }
    if (fileName === '.roomodes') {
      return {
        toolName: 'Roo Modes',
        category: 'cline',
        description: 'Custom mode definitions for Roo Code',
        icon: '$(robot)'
      };
    }

    // Gemini / Antigravity
    if (normalized.includes('/.gemini/rules/') || normalized.startsWith('.gemini/rules/')) {
      return {
        toolName: 'Gemini Rule',
        category: 'gemini',
        description: 'Antigravity / Gemini system instruction rule',
        icon: '$(sparkle)'
      };
    }
    if (fileName === 'GEMINI.md') {
      return {
        toolName: 'Gemini Context',
        category: 'gemini',
        description: 'Gemini / Antigravity project instructions',
        icon: '$(sparkle)'
      };
    }
    if (fileName === 'INSTRUCTIONS.md' || fileName === 'AGENTS.md') {
      return {
        toolName: 'Agent Instructions',
        category: 'gemini',
        description: 'General AI Agent context & instructions',
        icon: '$(sparkle)'
      };
    }

    // Copilot
    if (normalized.includes('.github/copilot-instructions.md')) {
      return {
        toolName: 'Copilot Instructions',
        category: 'copilot',
        description: 'GitHub Copilot custom instructions',
        icon: '$(github)'
      };
    }

    // Generic Prompt files
    if (fileName.endsWith('.prompt.md') || normalized.includes('/.prompts/') || normalized.startsWith('.prompts/')) {
      return {
        toolName: 'AI Prompt Template',
        category: 'custom',
        description: 'Custom prompt template file',
        icon: '$(note)'
      };
    }

    return null;
  }
}
