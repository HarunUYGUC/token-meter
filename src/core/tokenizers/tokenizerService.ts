import type * as vscodeType from 'vscode';
let vscode: typeof vscodeType | undefined;
try {
  vscode = require('vscode');
} catch {}
import { ITokenizer } from './baseTokenizer';
import { GptTokenizer } from './gptTokenizer';
import { ClaudeTokenizer } from './claudeTokenizer';
import { GeminiTokenizer } from './geminiTokenizer';
import { DeepSeekTokenizer } from './deepseekTokenizer';
import { DEFAULT_MODEL_ID, ModelMetadata, SUPPORTED_MODELS } from '../../constants';

class SimpleEmitter<T> {
  private listeners: ((e: T) => any)[] = [];
  event = (listener: (e: T) => any) => {
    this.listeners.push(listener);
    return { dispose: () => { this.listeners = this.listeners.filter(l => l !== listener); } };
  };
  fire(data: T) {
    this.listeners.forEach(l => l(data));
  }
}

export class TokenizerService {
  private static instance: TokenizerService;
  private tokenizers: Map<string, ITokenizer> = new Map();
  private activeModelId: string = DEFAULT_MODEL_ID;

  private _onDidChangeActiveModel: any;
  readonly onDidChangeActiveModel: any;

  private constructor() {
    try {
      if (typeof vscode !== 'undefined' && vscode?.EventEmitter) {
        this._onDidChangeActiveModel = new vscode.EventEmitter<ModelMetadata>();
        this.onDidChangeActiveModel = this._onDidChangeActiveModel.event;
      } else {
        const emitter = new SimpleEmitter<ModelMetadata>();
        this._onDidChangeActiveModel = emitter;
        this.onDidChangeActiveModel = emitter.event;
      }
    } catch {
      const emitter = new SimpleEmitter<ModelMetadata>();
      this._onDidChangeActiveModel = emitter;
      this.onDidChangeActiveModel = emitter.event;
    }

    this.registerTokenizer(new ClaudeTokenizer());
    this.registerTokenizer(new GptTokenizer());
    this.registerTokenizer(new GeminiTokenizer());
    this.registerTokenizer(new DeepSeekTokenizer());

    // Load initial model from VS Code configuration if set
    try {
      if (typeof vscode !== 'undefined' && vscode?.workspace?.getConfiguration) {
        const config = vscode.workspace.getConfiguration('tokenMeter');
        const defaultModel = (config.get('defaultModel', DEFAULT_MODEL_ID) || DEFAULT_MODEL_ID) as string;
        if (this.tokenizers.has(defaultModel)) {
          this.activeModelId = defaultModel;
        }
      }
    } catch {}
  }

  public static getInstance(): TokenizerService {
    if (!TokenizerService.instance) {
      TokenizerService.instance = new TokenizerService();
    }
    return TokenizerService.instance;
  }

  public registerTokenizer(tokenizer: ITokenizer) {
    this.tokenizers.set(tokenizer.id, tokenizer);
  }

  public getActiveModelId(): string {
    return this.activeModelId;
  }

  public getActiveModelMetadata(): ModelMetadata {
    return SUPPORTED_MODELS[this.activeModelId] || SUPPORTED_MODELS[DEFAULT_MODEL_ID];
  }

  public getAllModels(): ModelMetadata[] {
    return Object.values(SUPPORTED_MODELS);
  }

  public getActiveTokenizer(): ITokenizer {
    const tokenizer = this.tokenizers.get(this.activeModelId);
    if (!tokenizer) {
      return this.tokenizers.get(DEFAULT_MODEL_ID) || new ClaudeTokenizer();
    }
    return tokenizer;
  }

  public getTokenizer(modelId: string): ITokenizer | undefined {
    return this.tokenizers.get(modelId);
  }

  public setActiveModel(modelId: string): boolean {
    if (this.tokenizers.has(modelId) && this.activeModelId !== modelId) {
      this.activeModelId = modelId;
      const metadata = this.getActiveModelMetadata();
      this._onDidChangeActiveModel.fire(metadata);
      return true;
    }
    return false;
  }

  public countTokens(text: string, modelId?: string): number {
    if (!text || text.length === 0) {
      return 0;
    }
    const tokenizer = modelId ? (this.tokenizers.get(modelId) || this.getActiveTokenizer()) : this.getActiveTokenizer();
    return tokenizer.countTokens(text);
  }
}
