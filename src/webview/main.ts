import { TreemapVisualizer, TreemapNodeData, formatTokenNumber } from './treemap';

declare function acquireVsCodeApi(): {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
};

const vscode = acquireVsCodeApi();

interface SkillPayloadItem {
  id: string;
  name: string;
  description: string;
  ecosystem: string;
  scope: string;
  indexTokens: number;
  coreTokens: number;
  bundleTokens: number;
  files: Array<{ relativePath: string; tokens: number; size: number }>;
}

interface RulePayloadItem {
  name: string;
  relativePath: string;
  tokens: number;
  ruleInfo?: { toolName: string };
}

interface WebviewPayload {
  hierarchy: TreemapNodeData[];
  activeModel: {
    id: string;
    name: string;
    contextLimit: number;
    description: string;
  };
  totalTokens: number;
  allModels: Array<{ id: string; name: string }>;
  rules?: RulePayloadItem[];
  skills?: SkillPayloadItem[];
  totalSkillIndexTokens?: number;
}

let visualizer: TreemapVisualizer | null = null;
let currentData: WebviewPayload | null = null;
let currentSearchTerm: string = '';
let activeTargetBudget: number | 'auto' = 'auto';

// Simulator selection state
const selectedRules = new Set<string>();
const selectedSkills = new Set<string>();

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('treemap-container');
  const tooltip = document.getElementById('treemap-tooltip');
  const breadcrumbsEl = document.getElementById('breadcrumbs');
  const modelSelect = document.getElementById('model-select') as HTMLSelectElement;
  const budgetSelect = document.getElementById('budget-select') as HTMLSelectElement;
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const refreshBtn = document.getElementById('refresh-btn');

  const simToggleBtn = document.getElementById('simulator-toggle-btn');
  const simCloseBtn = document.getElementById('sim-close-btn');
  const simDrawer = document.getElementById('simulator-drawer');

  if (!container || !tooltip) return;

  visualizer = new TreemapVisualizer(
    container,
    tooltip,
    node => {
      vscode.postMessage({
        type: 'openFile',
        path: node.absolutePath
      });
    },
    pathNodes => {
      renderBreadcrumbs(pathNodes, breadcrumbsEl);
    }
  );

  // Model selection listener
  if (modelSelect) {
    modelSelect.addEventListener('change', e => {
      const selectedModelId = (e.target as HTMLSelectElement).value;
      vscode.postMessage({
        type: 'selectModel',
        modelId: selectedModelId
      });
    });
  }

  const customBudgetInput = document.getElementById('custom-budget-input') as HTMLInputElement;
  const customBudgetApplyBtn = document.getElementById('custom-budget-apply-btn');
  const customBudgetEditBtn = document.getElementById('custom-budget-edit-btn');

  // Target Budget selection listener
  if (budgetSelect) {
    const openCustomBudgetInput = () => {
      if (customBudgetInput) {
        customBudgetInput.classList.remove('hidden');
        if (activeTargetBudget !== 'auto') {
          // Format with dots as thousands e.g. "2.000.000"
          customBudgetInput.value = Number(activeTargetBudget).toLocaleString('tr-TR');
        } else {
          customBudgetInput.value = '50.000';
        }
        customBudgetInput.focus();
        customBudgetInput.select();
      }
      if (customBudgetApplyBtn) {
        customBudgetApplyBtn.classList.remove('hidden');
      }
    };

    const applyCustomBudget = () => {
      if (!customBudgetInput) return;
      const raw = customBudgetInput.value.trim();
      const parsed = parseTokenString(raw);
      if (parsed > 0) {
        activeTargetBudget = parsed;

        // Check if custom active option exists, if not create it
        let customActiveOpt = budgetSelect.querySelector('option[value="active_custom"]') as HTMLOptionElement;
        if (!customActiveOpt) {
          customActiveOpt = document.createElement('option');
          customActiveOpt.value = 'active_custom';
          // Insert right before custom_action option
          const customActionOpt = budgetSelect.querySelector('option[value="custom_action"]');
          budgetSelect.insertBefore(customActiveOpt, customActionOpt);
        }
        customActiveOpt.textContent = `Custom: ${formatTokenNumber(parsed)}`;
        budgetSelect.value = 'active_custom';

        if (customBudgetEditBtn) {
          customBudgetEditBtn.classList.remove('hidden');
        }
      } else {
        activeTargetBudget = 'auto';
        budgetSelect.value = 'auto';
        if (customBudgetEditBtn) customBudgetEditBtn.classList.add('hidden');
      }

      customBudgetInput.classList.add('hidden');
      if (customBudgetApplyBtn) customBudgetApplyBtn.classList.add('hidden');
      if (currentData) updateUI(currentData);
    };

    budgetSelect.addEventListener('change', e => {
      const val = (e.target as HTMLSelectElement).value;
      if (val === 'custom_action') {
        openCustomBudgetInput();
      } else if (val === 'active_custom') {
        if (customBudgetEditBtn) customBudgetEditBtn.classList.remove('hidden');
        if (currentData) updateUI(currentData);
      } else {
        if (customBudgetInput) customBudgetInput.classList.add('hidden');
        if (customBudgetApplyBtn) customBudgetApplyBtn.classList.add('hidden');
        if (customBudgetEditBtn) customBudgetEditBtn.classList.add('hidden');

        if (val === 'auto') {
          activeTargetBudget = 'auto';
        } else {
          activeTargetBudget = parseInt(val, 10);
        }
        if (currentData) updateUI(currentData);
      }
    });

    if (customBudgetEditBtn) {
      customBudgetEditBtn.addEventListener('click', () => {
        openCustomBudgetInput();
      });
    }

    if (customBudgetApplyBtn) {
      customBudgetApplyBtn.addEventListener('click', applyCustomBudget);
    }

    if (customBudgetInput) {
      // Live formatting as user types raw digits (e.g. 2000000 -> 2.000.000)
      customBudgetInput.addEventListener('input', e => {
        const input = e.target as HTMLInputElement;
        const val = input.value;
        // If user typed letters like k or m, don't format with dots
        if (/[a-zA-Z]/.test(val)) return;

        const digits = val.replace(/\D/g, '');
        if (digits.length > 3) {
          const formatted = Number(digits).toLocaleString('tr-TR');
          input.value = formatted;
        }
      });

      customBudgetInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          applyCustomBudget();
        } else if (e.key === 'Escape') {
          customBudgetInput.classList.add('hidden');
          if (customBudgetApplyBtn) customBudgetApplyBtn.classList.add('hidden');
          if (activeTargetBudget === 'auto') {
            budgetSelect.value = 'auto';
          } else {
            budgetSelect.value = 'active_custom';
          }
        }
      });
    }
  }

  // Search input listener
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      currentSearchTerm = (e.target as HTMLInputElement).value;
      if (currentData && currentData.hierarchy.length > 0 && visualizer) {
        visualizer.render(currentData.hierarchy[0], currentSearchTerm);
      }
    });
  }

  // Refresh button listener
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'refresh' });
    });
  }

  // Simulator Drawer Toggle
  if (simToggleBtn && simDrawer) {
    simToggleBtn.addEventListener('click', () => {
      simDrawer.classList.toggle('collapsed');
      if (!simDrawer.classList.contains('collapsed')) {
        simToggleBtn.classList.add('active');
      } else {
        simToggleBtn.classList.remove('active');
      }
    });
  }

  if (simCloseBtn && simDrawer && simToggleBtn) {
    simCloseBtn.addEventListener('click', () => {
      simDrawer.classList.add('collapsed');
      simToggleBtn.classList.remove('active');
    });
  }

  // Window resize handler
  window.addEventListener('resize', () => {
    if (currentData && currentData.hierarchy.length > 0 && visualizer) {
      visualizer.render(currentData.hierarchy[0], currentSearchTerm);
    }
  });

  // Ready message to VS Code
  vscode.postMessage({ type: 'ready' });
});

// Listen for messages from VS Code extension host
window.addEventListener('message', event => {
  const message = event.data;
  if (message.type === 'updateData') {
    currentData = message.payload as WebviewPayload;
    updateUI(currentData);
    updateSimulator(currentData);
  }
});

function parseTokenString(str: string): number {
  const clean = str.trim().toLowerCase();
  if (!clean) return 0;

  // Suffix: k (e.g. 50k, 1.5k, 50.5k)
  if (clean.endsWith('k')) {
    const val = parseFloat(clean.slice(0, -1).replace(/,/g, '.'));
    return isNaN(val) ? 0 : Math.round(val * 1000);
  }

  // Suffix: m (e.g. 2m, 1.5m, 2M)
  if (clean.endsWith('m')) {
    const val = parseFloat(clean.slice(0, -1).replace(/,/g, '.'));
    return isNaN(val) ? 0 : Math.round(val * 1000000);
  }

  // Pure digits with thousand separators (e.g. "2.000.000", "2,000,000", "2 000 000")
  const digitsOnly = clean.replace(/[\.\,\s]/g, '');
  const num = parseInt(digitsOnly, 10);
  return isNaN(num) ? 0 : num;
}

let currentEstimatedPrompt = 0;

function updateBudgetMeter(payload: WebviewPayload, simPrompt: number) {
  currentEstimatedPrompt = simPrompt;

  const totalTokensEl = document.getElementById('stat-total-tokens');
  const modelMaxEl = document.getElementById('stat-model-max');
  const fillPctEl = document.getElementById('stat-fill-pct');
  const simPlusContainer = document.getElementById('stat-sim-plus-container');
  const simTokensEl = document.getElementById('stat-sim-tokens');
  const combinedTokensEl = document.getElementById('stat-combined-tokens');

  const meterFillWorkspace = document.getElementById('budget-meter-fill-workspace');
  const meterFillSim = document.getElementById('budget-meter-fill-sim');
  const trackContainer = document.getElementById('budget-track-container');

  const workspaceTotal = payload.totalTokens || 0;
  const combinedTotal = workspaceTotal + simPrompt;
  const modelMaxLimit = payload.activeModel.contextLimit || 200000;

  const effectiveLimit = activeTargetBudget === 'auto' ? modelMaxLimit : activeTargetBudget;
  const workspacePct = (workspaceTotal / effectiveLimit) * 100;
  const simPct = (simPrompt / effectiveLimit) * 100;
  const combinedPct = (combinedTotal / effectiveLimit) * 100;

  if (totalTokensEl) totalTokensEl.textContent = formatTokenNumber(workspaceTotal);
  if (modelMaxEl) modelMaxEl.textContent = formatTokenNumber(modelMaxLimit);

  if (simPlusContainer && simTokensEl && combinedTokensEl) {
    if (simPrompt > 0) {
      simPlusContainer.classList.remove('hidden');
      simTokensEl.textContent = formatTokenNumber(simPrompt);
      combinedTokensEl.textContent = formatTokenNumber(combinedTotal);
    } else {
      simPlusContainer.classList.add('hidden');
    }
  }

  if (fillPctEl) {
    fillPctEl.textContent = `${combinedPct.toFixed(1)}%`;
    if (combinedPct > 100) {
      fillPctEl.style.color = '#ef4444';
    } else {
      fillPctEl.style.color = '#38bdf8';
    }
  }

  if (trackContainer) {
    if (combinedPct > 100) {
      trackContainer.classList.add('overflow');
    } else {
      trackContainer.classList.remove('overflow');
    }
  }

  if (meterFillWorkspace) {
    const wsFillWidth = Math.min(100, workspacePct);
    meterFillWorkspace.style.width = `${wsFillWidth}%`;
  }

  if (meterFillSim) {
    const remainingWidth = Math.max(0, 100 - Math.min(100, workspacePct));
    const simFillWidth = Math.min(remainingWidth, simPct);
    meterFillSim.style.width = `${simFillWidth}%`;
  }
}

function updateUI(payload: WebviewPayload) {
  // Update model select options
  const modelSelect = document.getElementById('model-select') as HTMLSelectElement;
  if (modelSelect && payload.allModels) {
    modelSelect.innerHTML = '';
    payload.allModels.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      opt.selected = m.id === payload.activeModel.id;
      modelSelect.appendChild(opt);
    });
  }

  // Update segmented budget meter bar & target limit
  updateBudgetMeter(payload, currentEstimatedPrompt);

  // Render Treemap
  if (visualizer && payload.hierarchy && payload.hierarchy.length > 0) {
    visualizer.render(payload.hierarchy[0], currentSearchTerm);
  }
}

function updateSimulator(payload: WebviewPayload) {
  const ecosystemBadge = document.getElementById('sim-ecosystem-badge');
  const rulesListEl = document.getElementById('sim-rules-list');
  const skillsListEl = document.getElementById('sim-skills-list');

  if (ecosystemBadge) {
    ecosystemBadge.textContent = payload.activeModel.name.split(' ')[0] + ' Ecosystem';
  }

  // 1. Render Baseline Rules
  if (rulesListEl) {
    rulesListEl.innerHTML = '';
    const rules = payload.rules || [];

    if (rules.length === 0) {
      rulesListEl.innerHTML = `<div class="sim-empty-hint">No baseline rules in workspace (0 tokens)</div>`;
    } else {
      rules.forEach(r => {
        // By default select all existing rules
        if (!selectedRules.has(r.relativePath)) {
          selectedRules.add(r.relativePath);
        }

        const div = document.createElement('div');
        div.className = 'sim-item-row';
        div.innerHTML = `
          <label class="sim-checkbox-label">
            <input type="checkbox" data-rule="${r.relativePath}" ${selectedRules.has(r.relativePath) ? 'checked' : ''} />
            <span class="sim-item-name">📄 ${r.name}</span>
          </label>
          <span class="sim-item-tokens">${formatTokenNumber(r.tokens)}</span>
        `;

        const input = div.querySelector('input');
        if (input) {
          input.addEventListener('change', e => {
            if ((e.target as HTMLInputElement).checked) {
              selectedRules.add(r.relativePath);
            } else {
              selectedRules.delete(r.relativePath);
            }
            calculateSimulatorTotal(payload);
          });
        }

        rulesListEl.appendChild(div);
      });
    }
  }

  // 2. Render Skills List
  if (skillsListEl) {
    skillsListEl.innerHTML = '';
    const skills = payload.skills || [];

    if (skills.length === 0) {
      skillsListEl.innerHTML = `<div class="sim-empty-hint">No skills discovered for this model</div>`;
    } else {
      skills.forEach(s => {
        const div = document.createElement('div');
        div.className = 'sim-item-row';
        const isMulti = s.files.length > 1;
        div.innerHTML = `
          <label class="sim-checkbox-label">
            <input type="checkbox" data-skill="${s.id}" ${selectedSkills.has(s.id) ? 'checked' : ''} />
            <span class="sim-item-name">🧠 ${s.name}</span>
          </label>
          <div class="sim-skill-stats">
            <span class="badge-core">Core: ${formatTokenNumber(s.coreTokens)}</span>
            ${isMulti ? `<span class="badge-bundle">Bundle: ${formatTokenNumber(s.bundleTokens)}</span>` : ''}
          </div>
        `;

        const input = div.querySelector('input');
        if (input) {
          input.addEventListener('change', e => {
            if ((e.target as HTMLInputElement).checked) {
              selectedSkills.add(s.id);
            } else {
              selectedSkills.delete(s.id);
            }
            calculateSimulatorTotal(payload);
          });
        }

        skillsListEl.appendChild(div);
      });
    }
  }

  calculateSimulatorTotal(payload);
}

function calculateSimulatorTotal(payload: WebviewPayload) {
  let totalRules = 0;
  let totalSkills = 0;

  const rules = payload.rules || [];
  const skills = payload.skills || [];

  rules.forEach(r => {
    if (selectedRules.has(r.relativePath)) {
      totalRules += r.tokens;
    }
  });

  skills.forEach(s => {
    if (selectedSkills.has(s.id)) {
      totalSkills += s.coreTokens;
    }
  });

  // Also include baseline index tokens of all skills in system prompt
  const indexOverhead = payload.totalSkillIndexTokens || 0;
  const estimatedPrompt = totalRules + totalSkills + indexOverhead;
  const limit = payload.activeModel.contextLimit || 200000;
  const pct = (estimatedPrompt / limit) * 100;

  const simRulesTokensEl = document.getElementById('sim-rules-tokens');
  const simSkillsTokensEl = document.getElementById('sim-skills-tokens');
  const simTotalTokensEl = document.getElementById('sim-total-tokens');
  const simBudgetPctEl = document.getElementById('sim-budget-pct');

  if (simRulesTokensEl) simRulesTokensEl.textContent = formatTokenNumber(totalRules);
  if (simSkillsTokensEl) simSkillsTokensEl.textContent = formatTokenNumber(totalSkills + indexOverhead);
  if (simTotalTokensEl) simTotalTokensEl.textContent = formatTokenNumber(estimatedPrompt);
  if (simBudgetPctEl) simBudgetPctEl.textContent = `(${pct.toFixed(2)}% of ${formatTokenNumber(limit)})`;

  // Update top segmented budget meter bar in real-time
  updateBudgetMeter(payload, estimatedPrompt);
}

function renderBreadcrumbs(pathNodes: TreemapNodeData[], container: HTMLElement | null) {
  if (!container) return;
  container.innerHTML = '';

  pathNodes.forEach((node, index) => {
    const isLast = index === pathNodes.length - 1;
    const span = document.createElement('span');
    span.className = `breadcrumb-item ${isLast ? 'active' : ''}`;
    span.textContent = node.name || 'Root';

    if (!isLast) {
      span.addEventListener('click', () => {
        if (visualizer) {
          visualizer.zoomTo(index);
        }
      });
    }

    container.appendChild(span);

    if (!isLast) {
      const sep = document.createElement('span');
      sep.className = 'breadcrumb-separator';
      sep.textContent = ' / ';
      container.appendChild(sep);
    }
  });
}
