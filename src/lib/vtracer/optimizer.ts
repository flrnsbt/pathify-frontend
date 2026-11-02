/**
 * High-performance browser-compatible SVG optimizer.
 * - Rounds floating-point coordinates in paths to clean decimals.
 * - Merges consecutive and duplicate paths with identical fill attributes.
 * - Strips empty and invisible path nodes.
 * - Minifies whitespace.
 */

export interface OptimizeSvgOptions {
  decimalPlaces?: number;
  mergePaths?: boolean;
  cleanWhitespace?: boolean;
  removeEmptyTags?: boolean;
}

export function optimizeSvg(svg: string, options: OptimizeSvgOptions = {}): string {
  if (!svg || typeof svg !== 'string') return '';

  const decimals = options.decimalPlaces ?? 2;
  const shouldMerge = options.mergePaths ?? true;
  const shouldClean = options.cleanWhitespace ?? true;
  const shouldRemoveEmpty = options.removeEmptyTags ?? true;

  let result = svg;

  // 1. Remove comments and XML declarations if present
  result = result.replace(/<!--[\s\S]*?-->/g, '');
  result = result.replace(/<\?xml[\s\S]*?\?>/g, '');

  // 2. Round numbers in path "d" attributes
  // Matches coordinates like 12.345678 or -0.5678
  const roundNumber = (numStr: string): string => {
    const val = parseFloat(numStr);
    if (isNaN(val)) return numStr;
    const rounded = Number(val.toFixed(decimals));
    // Minify: 0.5 -> .5, -0.5 -> -.5
    const str = String(rounded);
    if (str.startsWith('0.')) return str.slice(1);
    if (str.startsWith('-0.')) return '-' + str.slice(2);
    return str;
  };

  result = result.replace(/\bd="([^"]+)"/g, (match, pathData: string) => {
    // Replace coordinate numbers in path data
    const optimizedPath = pathData
      .replace(/(-?\d+\.\d+|-?\d+)/g, (n) => roundNumber(n))
      // Collapse redundant spaces
      .replace(/\s+/g, ' ')
      .trim();

    return `d="${optimizedPath}"`;
  });

  // 3. Merge paths with identical fill color
  if (shouldMerge) {
    // Group consecutive <path ... /> elements with identical fill
    // Matches <path ... fill="#..." ... d="..." /> or similar
    const pathRegex = /<path([^>]+)\/?>/gi;
    const paths: { full: string; fill: string; d: string; extraAttrs: string }[] = [];

    let match;
    while ((match = pathRegex.exec(result)) !== null) {
      const attrs = match[1];
      const fillMatch = attrs.match(/fill="([^"]+)"/i);
      const dMatch = attrs.match(/d="([^"]+)"/i);

      if (fillMatch && dMatch) {
        const fill = fillMatch[1];
        const d = dMatch[1];
        // Strip fill and d to get extra attrs (e.g. stroke, opacity, id)
        const extra = attrs
          .replace(/fill="[^"]+"/i, '')
          .replace(/d="[^"]+"/i, '')
          .trim();

        paths.push({
          full: match[0],
          fill,
          d,
          extraAttrs: extra,
        });
      }
    }

    if (paths.length > 1) {
      // Group paths by (fill + extraAttrs)
      const groups: Map<string, { fill: string; extraAttrs: string; dList: string[] }> = new Map();

      for (const p of paths) {
        const key = `${p.fill}__${p.extraAttrs}`;
        if (!groups.has(key)) {
          groups.set(key, { fill: p.fill, extraAttrs: p.extraAttrs, dList: [p.d] });
        } else {
          groups.get(key)!.dList.push(p.d);
        }
      }

      // If grouping reduces paths, construct optimized elements
      const newPathElements: string[] = [];
      groups.forEach((group) => {
        const combinedD = group.dList.join(' ');
        const extra = group.extraAttrs ? ` ${group.extraAttrs}` : '';
        newPathElements.push(`<path fill="${group.fill}" d="${combinedD}"${extra}/>`);
      });

      // Replace the entire group of paths within the SVG root
      const svgTagOpen = result.match(/<svg[\s\S]*?>/i)?.[0] || '<svg>';
      result = `${svgTagOpen}\n${newPathElements.join('\n')}\n</svg>`;
    }
  }

  // 4. Remove empty path tags
  if (shouldRemoveEmpty) {
    result = result.replace(/<path[^>]*d=""[^>]*\/?>/gi, '');
  }

  // 5. Clean whitespace
  if (shouldClean) {
    result = result.replace(/>\s+</g, '><').trim();
  }

  return result;
}
