import nunjucks from 'nunjucks';

// Configure nunjucks for mobile (no file system template loading)
const env = new nunjucks.Environment(null, {
  autoescape: false,
  throwOnUndefined: false,
});

export interface RenderResult {
  success: boolean;
  rendered?: string;
  error?: string;
}

/**
 * Renders a Jinja2/Nunjucks template with the given data.
 * This replaces the Python bridge used in the desktop app.
 */
export function renderTemplate(
  template: string,
  data: Record<string, unknown>
): RenderResult {
  try {
    const rendered = env.renderString(template, data);
    return { success: true, rendered };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Template rendering failed',
    };
  }
}

/**
 * Extracts placeholder variable names from a template string.
 * Matches {{ variable_name }} patterns.
 */
export function extractPlaceholders(template: string): string[] {
  const regex = /\{\{\s*(\w+)\s*\}\}/g;
  const placeholders = new Set<string>();
  let match;
  while ((match = regex.exec(template)) !== null) {
    placeholders.add(match[1]);
  }
  return Array.from(placeholders);
}
