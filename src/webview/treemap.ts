import * as d3 from 'd3';

export interface TreemapNodeData {
  name: string;
  relativePath: string;
  absolutePath: string;
  isDirectory: boolean;
  size: number;
  tokens: number;
  isRule: boolean;
  ruleInfo?: {
    toolName: string;
    category: string;
    description: string;
  } | null;
  children?: TreemapNodeData[];
}

export function formatTokenNumber(tokens: number): string {
  if (tokens < 1000) return tokens.toLocaleString();
  if (tokens < 1000000) {
    const k = tokens / 1000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}k`;
  }
  const m = tokens / 1000000;
  return `${m.toFixed(2).replace(/\.00$/, '')}M`;
}

export function getNodeColor(tokens: number, isRule: boolean): string {
  if (isRule) {
    return '#8b5cf6'; // Violet for AI rules
  }
  if (tokens < 1000) return '#10b981'; // Green
  if (tokens < 8000) return '#eab308'; // Yellow
  if (tokens < 30000) return '#f97316'; // Orange
  return '#ef4444'; // Red
}

export class TreemapVisualizer {
  private container: HTMLElement;
  private tooltip: HTMLElement;
  private onNodeClick: (node: TreemapNodeData) => void;
  private currentRoot: TreemapNodeData | null = null;
  private currentPathNodes: TreemapNodeData[] = [];
  private onBreadcrumbChange?: (path: TreemapNodeData[]) => void;

  constructor(
    container: HTMLElement,
    tooltip: HTMLElement,
    onNodeClick: (node: TreemapNodeData) => void,
    onBreadcrumbChange?: (path: TreemapNodeData[]) => void
  ) {
    this.container = container;
    this.tooltip = tooltip;
    this.onNodeClick = onNodeClick;
    this.onBreadcrumbChange = onBreadcrumbChange;
  }

  public render(rootData: TreemapNodeData, searchTerm: string = '') {
    this.currentRoot = rootData;

    // Sync current path nodes with the incoming fresh hierarchy
    if (this.currentPathNodes.length <= 1) {
      this.currentPathNodes = [rootData];
    } else {
      const updatedPath: TreemapNodeData[] = [rootData];
      let currentParent: TreemapNodeData = rootData;
      for (let i = 1; i < this.currentPathNodes.length; i++) {
        const targetName = this.currentPathNodes[i].name;
        const matchingChild = currentParent.children?.find(c => c.name === targetName);
        if (matchingChild) {
          updatedPath.push(matchingChild);
          currentParent = matchingChild;
        } else {
          break;
        }
      }
      this.currentPathNodes = updatedPath;
    }

    if (this.onBreadcrumbChange) {
      this.onBreadcrumbChange(this.currentPathNodes);
    }

    this.container.innerHTML = '';
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    if (!rootData.children || rootData.children.length === 0) {
      this.container.innerHTML = `<div class="empty-state">
        <p>No token data available for this view.</p>
      </div>`;
      return;
    }

    // Use current display node from synced path
    const displayData = this.currentPathNodes[this.currentPathNodes.length - 1];

    // Create D3 Hierarchy
    const root = d3
      .hierarchy<TreemapNodeData>(displayData)
      .sum(d => (!d.isDirectory ? Math.max(d.tokens, 1) : 0))
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Create D3 Treemap layout
    const treemapLayout = d3
      .treemap<TreemapNodeData>()
      .size([width, height])
      .paddingOuter(4)
      .paddingTop(22)
      .paddingInner(3)
      .round(true)
      .tile(d3.treemapSquarify.ratio(1));

    const hierarchy = treemapLayout(root);

    // SVG Container
    const svg = d3
      .select(this.container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('style', 'width: 100%; height: 100%; font-family: var(--vscode-font-family);');

    // Group for nodes
    const nodes = svg
      .selectAll('g')
      .data(hierarchy.descendants())
      .enter()
      .append('g')
      .attr('transform', d => `translate(${d.x0},${d.y0})`);

    // Render Tiles
    nodes
      .append('rect')
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('class', d => `treemap-tile ${d.data.isDirectory ? 'is-dir' : 'is-file'}`)
      .attr('fill', d => {
        if (d.data.isDirectory) {
          return 'var(--vscode-sideBar-background, #1e1e1e)';
        }
        return getNodeColor(d.data.tokens, d.data.isRule);
      })
      .attr('stroke', d => (d.data.isDirectory ? 'var(--vscode-widget-border, #333)' : 'rgba(0,0,0,0.2)'))
      .attr('stroke-width', 1)
      .attr('opacity', d => {
        if (searchTerm && !d.data.name.toLowerCase().includes(searchTerm.toLowerCase())) {
          return 0.2;
        }
        return d.data.isDirectory ? 0.95 : 0.85;
      })
      .on('mouseover', (event, d) => {
        this.showTooltip(event, d.data, rootData.tokens);
        d3.select(event.currentTarget).attr('opacity', 1).attr('stroke', '#38bdf8').attr('stroke-width', 2);
      })
      .on('mousemove', event => {
        this.moveTooltip(event);
      })
      .on('mouseout', (event, d) => {
        this.hideTooltip();
        d3.select(event.currentTarget)
          .attr('opacity', d.data.isDirectory ? 0.95 : 0.85)
          .attr('stroke', d.data.isDirectory ? 'var(--vscode-widget-border, #333)' : 'rgba(0,0,0,0.2)')
          .attr('stroke-width', 1);
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        if (d.data.isDirectory && d.data !== displayData && d.data.children && d.data.children.length > 0) {
          this.zoomIn(d.data);
        } else if (!d.data.isDirectory) {
          this.onNodeClick(d.data);
        }
      });

    // Render Text Labels
    nodes
      .append('text')
      .attr('x', 6)
      .attr('y', d => (d.data.isDirectory ? 15 : 18))
      .attr('fill', d => (d.data.isDirectory ? 'var(--vscode-foreground, #ccc)' : '#ffffff'))
      .attr('font-size', d => (d.data.isDirectory ? '11px' : '12px'))
      .attr('font-weight', d => (d.data.isDirectory ? '600' : '500'))
      .attr('pointer-events', 'none')
      .text(d => {
        const boxWidth = d.x1 - d.x0;
        const boxHeight = d.y1 - d.y0;
        if (boxWidth < 45 || boxHeight < 25) return '';

        const name = d.data.name;
        const tokensStr = formatTokenNumber(d.data.tokens);
        if (d.data.isDirectory) {
          return `${name} (${tokensStr})`;
        }
        return boxWidth > 90 ? `${name}` : name.slice(0, 8) + '...';
      });

    // Render Subtitle / Tokens for file tiles
    nodes
      .filter(d => !d.data.isDirectory)
      .append('text')
      .attr('x', 6)
      .attr('y', 33)
      .attr('fill', 'rgba(255, 255, 255, 0.85)')
      .attr('font-size', '10px')
      .attr('pointer-events', 'none')
      .text(d => {
        const boxWidth = d.x1 - d.x0;
        const boxHeight = d.y1 - d.y0;
        if (boxWidth < 55 || boxHeight < 40) return '';
        return `${formatTokenNumber(d.data.tokens)} tokens`;
      });
  }

  public zoomIn(node: TreemapNodeData) {
    this.currentPathNodes.push(node);
    if (this.onBreadcrumbChange) {
      this.onBreadcrumbChange(this.currentPathNodes);
    }
    if (this.currentRoot) {
      this.render(this.currentRoot);
    }
  }

  public zoomTo(index: number) {
    if (index >= 0 && index < this.currentPathNodes.length) {
      this.currentPathNodes = this.currentPathNodes.slice(0, index + 1);
      if (this.onBreadcrumbChange) {
        this.onBreadcrumbChange(this.currentPathNodes);
      }
      if (this.currentRoot) {
        this.render(this.currentRoot);
      }
    }
  }

  private showTooltip(event: MouseEvent, data: TreemapNodeData, totalWorkspaceTokens: number) {
    const pct = totalWorkspaceTokens > 0 ? ((data.tokens / totalWorkspaceTokens) * 100).toFixed(1) : '0';
    const ruleBadge = data.isRule && data.ruleInfo ? `<div class="tooltip-badge">🤖 ${data.ruleInfo.toolName}</div>` : '';

    this.tooltip.innerHTML = `
      <div class="tooltip-header">
        <span class="tooltip-icon">${data.isDirectory ? '📁' : '📄'}</span>
        <strong>${data.name}</strong>
      </div>
      ${ruleBadge}
      <div class="tooltip-row">
        <span>Path:</span>
        <code>${data.relativePath || '.'}</code>
      </div>
      <div class="tooltip-row">
        <span>Tokens:</span>
        <strong style="color: ${getNodeColor(data.tokens, data.isRule)}">${data.tokens.toLocaleString()} (${formatTokenNumber(data.tokens)})</strong>
      </div>
      <div class="tooltip-row">
        <span>Workspace Share:</span>
        <strong>${pct}%</strong>
      </div>
      ${data.isDirectory ? '<div class="tooltip-hint">Click folder to zoom in</div>' : '<div class="tooltip-hint">Click to open file in editor</div>'}
    `;

    this.tooltip.style.display = 'block';
    this.moveTooltip(event);
  }

  private moveTooltip(event: MouseEvent) {
    const offset = 12;
    let left = event.clientX + offset;
    let top = event.clientY + offset;

    const tooltipRect = this.tooltip.getBoundingClientRect();
    if (left + tooltipRect.width > window.innerWidth) {
      left = event.clientX - tooltipRect.width - offset;
    }
    if (top + tooltipRect.height > window.innerHeight) {
      top = event.clientY - tooltipRect.height - offset;
    }

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
  }

  private hideTooltip() {
    this.tooltip.style.display = 'none';
  }
}
