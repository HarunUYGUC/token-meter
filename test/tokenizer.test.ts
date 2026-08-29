import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { ClaudeTokenizer } from '../src/core/tokenizers/claudeTokenizer';
import { GptTokenizer } from '../src/core/tokenizers/gptTokenizer';
import { GeminiTokenizer } from '../src/core/tokenizers/geminiTokenizer';
import { DeepSeekTokenizer } from '../src/core/tokenizers/deepseekTokenizer';
import { RuleDetector } from '../src/core/ruleDetector';
import { SkillDetector } from '../src/core/skillDetector';
import { CacheManager } from '../src/core/cacheManager';
import { formatTokenCount, formatPercentage, formatBytes } from '../src/utils/formatters';

describe('Token Meter - Unit Tests', () => {
  describe('Tokenizer Comparison & Accuracy', () => {
    const claude = new ClaudeTokenizer();
    const gpt = new GptTokenizer();
    const gemini = new GeminiTokenizer();
    const deepseek = new DeepSeekTokenizer();

    const sampleCode = `
import React, { useState, useEffect } from 'react';

export const UserProfile = ({ userId }: { userId: string }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/users/' + userId)
      .then(res => res.json())
      .then(data => {
        setUser(data);
        setLoading(false);
      });
  }, [userId]);

  if (loading) return <div>Yükleniyor...</div>;
  return <div className="profile"><h1>{user?.name}</h1></div>;
};
    `.trim();

    const turkishText = 'Yapay zeka modellerinin token tüketimini ve bağlam penceresi maliyetlerini gerçek zamanlı olarak hesaplayan eklenti geliştiriyoruz.';

    it('should calculate non-zero token counts for code in all models', () => {
      const claudeTokens = claude.countTokens(sampleCode);
      const gptTokens = gpt.countTokens(sampleCode);
      const geminiTokens = gemini.countTokens(sampleCode);
      const deepseekTokens = deepseek.countTokens(sampleCode);

      console.log(`\n📊 Sample Code Token Comparison:`);
      console.log(`- Claude 3.5/3.7: ${claudeTokens} tokens`);
      console.log(`- GPT-4o (o200k): ${gptTokens} tokens`);
      console.log(`- Gemini (256k): ${geminiTokens} tokens`);
      console.log(`- DeepSeek V3: ${deepseekTokens} tokens`);

      assert.ok(claudeTokens > 50, 'Claude tokens should be > 50');
      assert.ok(gptTokens > 50, 'GPT-4o tokens should be > 50');
      assert.ok(geminiTokens > 50, 'Gemini tokens should be > 50');
      assert.ok(deepseekTokens > 50, 'DeepSeek tokens should be > 50');
    });

    it('should show vocabulary compression differences for Turkish text', () => {
      const claudeTR = claude.countTokens(turkishText);
      const gptTR = gpt.countTokens(turkishText);
      const geminiTR = gemini.countTokens(turkishText);

      console.log(`\n🇹🇷 Turkish Text Token Comparison:`);
      console.log(`- Claude 3.5/3.7: ${claudeTR} tokens`);
      console.log(`- GPT-4o (o200k): ${gptTR} tokens`);
      console.log(`- Gemini 2.0/3.x: ${geminiTR} tokens`);

      assert.ok(claudeTR > 0);
      assert.ok(gptTR > 0);
      assert.ok(geminiTR > 0);
    });

    it('should return 0 for empty string', () => {
      assert.strictEqual(claude.countTokens(''), 0);
      assert.strictEqual(gpt.countTokens(''), 0);
      assert.strictEqual(gemini.countTokens(''), 0);
      assert.strictEqual(deepseek.countTokens(''), 0);
    });
  });

  describe('RuleDetector', () => {
    it('should detect Cursor rule files', () => {
      assert.strictEqual(RuleDetector.isRuleFile('.cursorrules'), true);
      assert.strictEqual(RuleDetector.isRuleFile('.cursor/rules/api-guidelines.mdc'), true);
      const info = RuleDetector.getRuleInfo('.cursorrules');
      assert.strictEqual(info?.category, 'cursor');
    });

    it('should detect Windsurf, Cline and Copilot rule files', () => {
      assert.strictEqual(RuleDetector.isRuleFile('.windsurfrules'), true);
      assert.strictEqual(RuleDetector.isRuleFile('.clinerules'), true);
      assert.strictEqual(RuleDetector.isRuleFile('.github/copilot-instructions.md'), true);
    });

    it('should detect Gemini / Antigravity rule files', () => {
      assert.strictEqual(RuleDetector.isRuleFile('GEMINI.md'), true);
      assert.strictEqual(RuleDetector.isRuleFile('.gemini/rules/rules.md'), true);
    });

    it('should return false for regular code files', () => {
      assert.strictEqual(RuleDetector.isRuleFile('src/index.ts'), false);
      assert.strictEqual(RuleDetector.isRuleFile('package.json'), false);
    });
  });

  describe('CacheManager', () => {
    const cache = CacheManager.getInstance();

    it('should store and retrieve cached tokens', () => {
      cache.set('/test/file.ts', 1000, 500, 'gpt-4o', 120);
      assert.strictEqual(cache.get('/test/file.ts', 1000, 'gpt-4o'), 120);
    });

    it('should invalidate when mtime changes', () => {
      cache.set('/test/file.ts', 1000, 500, 'gpt-4o', 120);
      assert.strictEqual(cache.get('/test/file.ts', 2000, 'gpt-4o'), undefined);
    });
  });

  describe('Formatters', () => {
    it('should format numbers into k and M', () => {
      assert.strictEqual(formatTokenCount(250), '250');
      assert.strictEqual(formatTokenCount(1200), '1.2k');
      assert.strictEqual(formatTokenCount(45600), '45.6k');
      assert.strictEqual(formatTokenCount(120000), '120k');
      assert.strictEqual(formatTokenCount(1500000), '1.5M');
    });

    it('should format percentage and bytes', () => {
      assert.strictEqual(formatPercentage(25, 100), '25.0%');
      assert.strictEqual(formatBytes(1024), '1 KB');
    });
  });

  describe('SkillDetector', async () => {
    const skillDetector = SkillDetector.getInstance();

    it('should discover installed skills for active model', async () => {
      const skills = await skillDetector.getSkillsForActiveModel();
      console.log(`\n🧠 Discovered ${skills.length} skills for active ecosystem:`);
      skills.slice(0, 5).forEach(s => {
        console.log(`- ${s.name} (Index: ${s.indexTokens} | Core: ${formatTokenCount(s.coreTokens)} | Bundle: ${formatTokenCount(s.bundleTokens)} - ${s.files.length} files)`);
      });
      assert.ok(Array.isArray(skills));
    });
  });
});
