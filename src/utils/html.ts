/**
 * Marker class for HTML strings that should not be escaped.
 * Use raw() to wrap pre-built HTML fragments.
 */
export class SafeHtml {
  constructor(public readonly value: string) {}
  toString() { return this.value; }
}

/**
 * Mark a string as safe HTML that should not be escaped.
 * Use for pre-built HTML fragments that need to be embedded.
 *
 * Usage:
 *   const list = items.map(i => html`<li>${i.name}</li>`).join('');
 *   element.innerHTML = html`<ul>${raw(list)}</ul>`;
 */
export function raw(html: string): SafeHtml {
  return new SafeHtml(html);
}

/**
 * Tagged template literal for safe HTML construction.
 * Automatically escapes all interpolated values to prevent XSS.
 * Use raw() for values that are already safe HTML.
 *
 * Usage:
 *   element.innerHTML = html`<div class="user">${userName}</div>`;
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): string {
  let result = strings[0];
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value instanceof SafeHtml) {
      result += value.value;
    } else {
      result += escapeHtml(String(value ?? ''));
    }
    result += strings[i + 1];
  }
  return result;
}

/**
 * Escapes HTML special characters to prevent XSS.
 * Uses the browser's built-in escaping via textContent.
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Escapes a value for use in an HTML attribute.
 * Returns SafeHtml to prevent double-escaping when used inside html``.
 *
 * Usage:
 *   html`<input value="${attr(userInput)}">`
 */
export function attr(text: string): SafeHtml {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return new SafeHtml(escaped);
}
