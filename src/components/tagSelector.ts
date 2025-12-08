import { getAllTags } from '../storage/tags';

export interface TagSelectorOptions {
  containerId: string;
  initialTags?: string[];
  onChange?: (tags: string[]) => void;
}

export class TagSelector {
  private container: HTMLElement;
  private selectedTags: Set<string>;
  private onChange?: (tags: string[]) => void;

  constructor(options: TagSelectorOptions) {
    const container = document.getElementById(options.containerId);
    if (!container) {
      throw new Error(`Container ${options.containerId} not found`);
    }

    this.container = container;
    this.selectedTags = new Set(options.initialTags || []);
    this.onChange = options.onChange;

    this.render();
  }

  private render(): void {
    const allTags = getAllTags();
    const selectedTagsArray = Array.from(this.selectedTags);

    this.container.innerHTML = `
      <div class="tag-selector">
        <div class="selected-tags">
          ${selectedTagsArray.map(tag => `
            <span class="tag-chip">
              ${escapeHtml(tag)}
              <button type="button" class="tag-remove" data-tag="${escapeHtml(tag)}">&times;</button>
            </span>
          `).join('')}
        </div>

        <div class="tag-input-group">
          <input
            type="text"
            class="tag-input"
            placeholder="Add tag..."
            list="available-tags"
          />
          <button type="button" class="btn-add-tag">Add</button>
        </div>

        <datalist id="available-tags">
          ${allTags.map(tag => `
            <option value="${escapeHtml(tag.tagName)}">
          `).join('')}
        </datalist>

        ${allTags.length > 0 ? `
          <div class="suggested-tags">
            <small>Suggestions:</small>
            ${allTags.filter(tag => !this.selectedTags.has(tag.tagName)).slice(0, 5).map(tag => `
              <button type="button" class="tag-suggestion" data-tag="${escapeHtml(tag.tagName)}">
                ${escapeHtml(tag.tagName)}
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    // Remove tag buttons
    const removeButtons = this.container.querySelectorAll('.tag-remove');
    removeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tag = (e.target as HTMLElement).dataset.tag;
        if (tag) {
          this.removeTag(tag);
        }
      });
    });

    // Add tag button and input
    const input = this.container.querySelector('.tag-input') as HTMLInputElement;
    const addButton = this.container.querySelector('.btn-add-tag') as HTMLButtonElement;

    const addTag = () => {
      const value = input.value.trim();
      if (value) {
        this.addTag(value);
        input.value = '';
      }
    };

    if (addButton) {
      addButton.addEventListener('click', addTag);
    }

    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addTag();
        }
      });
    }

    // Suggestion buttons
    const suggestionButtons = this.container.querySelectorAll('.tag-suggestion');
    suggestionButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tag = (e.target as HTMLElement).dataset.tag;
        if (tag) {
          this.addTag(tag);
        }
      });
    });
  }

  private addTag(tag: string): void {
    const trimmed = tag.trim();
    if (trimmed && !this.selectedTags.has(trimmed)) {
      this.selectedTags.add(trimmed);
      this.render();
      this.notifyChange();
    }
  }

  private removeTag(tag: string): void {
    this.selectedTags.delete(tag);
    this.render();
    this.notifyChange();
  }

  private notifyChange(): void {
    if (this.onChange) {
      this.onChange(Array.from(this.selectedTags));
    }
  }

  public getTags(): string[] {
    return Array.from(this.selectedTags);
  }

  public setTags(tags: string[]): void {
    this.selectedTags = new Set(tags);
    this.render();
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
