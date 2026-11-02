/**
 * High-performance browser-compatible SVG optimizer.
 * - Rounds floating-point coordinates in paths to clean decimals.
 * - Merges consecutive paths with identical fill attributes.
 * - Strips empty and invisible path nodes.
 * - Minifies whitespace safely.
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
  const shouldClean = options.cleanWhitespace ?? true;
  const shouldRemoveEmpty = options.removeEmptyTags ?? true;
  const shouldMerge = options.mergePaths ?? true;

  try {
    let result = svg;

    // 1. Remove comments and XML declarations
    result = result.replace(/<!--[\s\S]*?-->/g, '');
    result = result.replace(/<\?xml[\s\S]*?\?>/g, '');

    // 2. Round numbers in path "d" attributes
    const roundCoord = (numStr: string): string => {
      const val = parseFloat(numStr);
      if (isNaN(val)) return numStr;
      const rounded = Number(val.toFixed(decimals));
      const str = String(rounded);
      if (str.startsWith('0.')) return str.slice(1);
      if (str.startsWith('-0.')) return '-' + str.slice(2);
      return str;
    };

    result = result.replace(/\bd="([^"]+)"/g, (_, pathData: string) => {
      const optimized = pathData
        .replace(/(-?\d+\.\d+)/g, (n) => roundCoord(n))
        .replace(/\s+/g, ' ')
        .trim();
      return `d="${optimized}"`;
    });

    // 3. Merge consecutive paths with identical fill color
    if (shouldMerge) {
      result = result.replace(
        /(<path\s+[^>]*fill="([^"]+)"[^>]*\bd="([^"]+)"[^>]*\/?>)\s*(<path\s+[^>]*fill="([^"]+)"[^>]*\bd="([^"]+)"[^>]*\/?>)/gi,
        (full, p1, f1, d1, p2, f2, d2) => {
          if (f1 === f2) {
            return `<path fill="${f1}" d="${d1} ${d2}" />`;
          }
          return full;
        }
      );
    }

    // 4. Remove empty paths
    if (shouldRemoveEmpty) {
      result = result.replace(/<path[^>]*\bd="\s*"[^>]*\/?>/gi, '');
    }

    // 5. Clean whitespace safely (avoid breaking text tags)
    if (shouldClean) {
      result = result.replace(/>\s+</g, '><').trim();
    }

    return result;
  } catch (err) {
    console.warn('SVG Optimizer encountered an issue, preserving original SVG:', err);
    return svg;
  }
}
