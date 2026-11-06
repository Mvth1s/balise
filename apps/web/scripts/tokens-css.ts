/**
 * Pure transformation of docs/charte/tokens.json into CSS custom properties.
 * Imported by scripts/build-tokens.ts (CLI) and by the freshness test.
 * Node built-ins only, no dependency: runnable with --experimental-strip-types.
 */

export interface ColorToken {
  name: string;
  value: Record<string, string>;
  usage?: string;
}

export interface TypeStyle {
  name: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
}

export interface TokensFile {
  name: string;
  version: number;
  color: { themes: { id: string; name: string }[]; tokens: ColorToken[] };
  type: {
    families: Record<string, string>;
    groups: { name: string; family: string; styles: TypeStyle[] }[];
  };
  spacing: { tokens: { name: string; value: string }[] };
  radius: { tokens: { name: string; value: string }[] };
}

const ROOT_FONT_SIZE = 16;

/** Converts "17px" to "1.0625rem" so that text follows the user's font size. */
export function pxToRem(value: string): string {
  const match = /^(-?\d+(?:\.\d+)?)px$/.exec(value.trim());
  if (!match?.[1]) return value;
  const rem = Number(match[1]) / ROOT_FONT_SIZE;
  return `${Number(rem.toFixed(4))}rem`;
}

/**
 * Self-hosted variable fonts (@fontsource-variable) register the family as
 * "<Family> Variable": put that name first, keep the charter name as fallback.
 */
export function withVariableFamily(stack: string): string {
  const first = /^\s*"([^"]+)"/.exec(stack);
  if (!first?.[1]) return stack;
  return `"${first[1]} Variable", ${stack.trim()}`.replaceAll('"', "'");
}

function colorBlock(tokens: ColorToken[], theme: string, indent: string): string[] {
  return tokens.map((t) => {
    const value = t.value[theme];
    if (!value) throw new Error(`Token ${t.name} has no value for theme ${theme}`);
    return `${indent}--color-${t.name}: ${value.toLowerCase()};`;
  });
}

export function generateTokensCss(tokens: TokensFile): string {
  const colors = tokens.color.tokens;
  const lines: string[] = [];
  lines.push('/*');
  lines.push(' * GENERATED FILE, DO NOT EDIT.');
  lines.push(' * Source: docs/charte/tokens.json. Regenerate with:');
  lines.push(' *   node --experimental-strip-types apps/web/scripts/build-tokens.ts');
  lines.push(' */');
  lines.push('');
  lines.push(':root {');
  lines.push('  color-scheme: light;');
  lines.push(...colorBlock(colors, 'light', '  '));
  lines.push('');
  for (const s of tokens.spacing.tokens) lines.push(`  --${s.name}: ${s.value};`);
  lines.push('');
  for (const r of tokens.radius.tokens) lines.push(`  --${r.name}: ${r.value};`);
  lines.push('');
  for (const [name, stack] of Object.entries(tokens.type.families)) {
    // Same wrapping as Prettier (printWidth 100) so the file stays stable.
    const decl = `  --font-${name}: ${withVariableFamily(stack)};`;
    lines.push(decl.length > 100 ? `  --font-${name}:\n    ${withVariableFamily(stack)};` : decl);
  }
  lines.push('');
  for (const group of tokens.type.groups) {
    for (const style of group.styles) {
      lines.push(`  --text-${style.name}-family: var(--font-${group.family});`);
      lines.push(`  --text-${style.name}-size: ${pxToRem(style.fontSize)};`);
      lines.push(`  --text-${style.name}-line: ${pxToRem(style.lineHeight)};`);
      lines.push(`  --text-${style.name}-weight: ${style.fontWeight};`);
    }
  }
  lines.push('}');
  lines.push('');
  lines.push('@media (prefers-color-scheme: dark) {');
  lines.push("  :root:not([data-theme='light']) {");
  lines.push('    color-scheme: dark;');
  lines.push(...colorBlock(colors, 'dark', '    '));
  lines.push('  }');
  lines.push('}');
  lines.push('');
  lines.push(":root[data-theme='dark'] {");
  lines.push('  color-scheme: dark;');
  lines.push(...colorBlock(colors, 'dark', '  '));
  lines.push('}');
  lines.push('');
  for (const group of tokens.type.groups) {
    for (const style of group.styles) {
      lines.push(`.text-${style.name} {`);
      lines.push(`  font-family: var(--text-${style.name}-family);`);
      lines.push(`  font-size: var(--text-${style.name}-size);`);
      lines.push(`  line-height: var(--text-${style.name}-line);`);
      lines.push(`  font-weight: var(--text-${style.name}-weight);`);
      lines.push('}');
      lines.push('');
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
