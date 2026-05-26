export const rgbToHsl = (red, green, blue) => {
  let r = red / 255;
  let g = green / 255;
  let b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
    if (max === g) hue = (b - r) / delta + 2;
    if (max === b) hue = (r - g) / delta + 4;
    hue *= 60;
  }

  return { hue, saturation: saturation * 100, lightness: lightness * 100 };
};

export const paletteIdFromHsl = ({ hue, saturation, lightness }) => {
  if (saturation < 16 || lightness < 10 || lightness > 94) return 'neutral';
  if (hue >= 345 || hue < 15) return 'red';
  if (hue >= 15 && hue < 38) return 'orange';
  if (hue >= 38 && hue < 75) return 'yellow';
  if (hue >= 75 && hue < 175) return 'green';
  if (hue >= 175 && hue < 255) return 'blue';
  if (hue >= 255 && hue < 295) return 'purple';
  return 'pink';
};

export const inferStyleFromBrandSignal = ({ palette, dominantHsl, neutralShare, darkShare, lightShare, vividShare, contrastRange }) => {
  if (neutralShare > 0.78 && contrastRange > 120) return darkShare > 0.45 ? 'luxury' : 'minimal';
  if (darkShare > 0.52 && vividShare > 0.12) return palette === 'blue' || palette === 'purple' ? 'tech' : 'night';
  if (vividShare > 0.42 && dominantHsl?.saturation > 58) return palette === 'yellow' || palette === 'orange' ? 'commerce' : 'bold';
  if (['green', 'yellow'].includes(palette) && dominantHsl?.saturation < 58) return 'organic';
  if (['pink', 'red', 'purple'].includes(palette) && lightShare > 0.42) return 'luxury';
  if (['blue', 'neutral'].includes(palette) && neutralShare > 0.45) return 'modern';
  return 'modern';
};

export const analyzePaletteFromImageSource = (source) => new Promise((resolve) => {
  if (!source || typeof window === 'undefined') {
    resolve({ palette: '', style: '', confidence: 0, colors: [] });
    return;
  }

  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      const size = 96;
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0, size, size);
      const pixels = context.getImageData(0, 0, size, size).data;
      const buckets = {};
      const colorSamples = [];
      let neutralScore = 0;
      let colorScore = 0;
      let darkScore = 0;
      let lightScore = 0;
      let vividScore = 0;
      let minLuma = 255;
      let maxLuma = 0;
      let sampled = 0;

      for (let index = 0; index < pixels.length; index += 16) {
        const alpha = pixels[index + 3];
        if (alpha < 160) continue;
        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        const luma = (red * 0.299) + (green * 0.587) + (blue * 0.114);
        const hsl = rgbToHsl(red, green, blue);
        if (hsl.lightness < 4 || hsl.lightness > 98) continue;
        const palette = paletteIdFromHsl(hsl);
        const colorWeight = Math.max(1, hsl.saturation) * (palette === 'neutral' ? 0.18 : 1);
        const contrastWeight = Math.abs(50 - hsl.lightness) / 50;
        const weight = colorWeight * (1 + contrastWeight * 0.45);
        buckets[palette] = (buckets[palette] || 0) + weight;
        sampled += 1;
        minLuma = Math.min(minLuma, luma);
        maxLuma = Math.max(maxLuma, luma);
        if (palette === 'neutral') neutralScore += weight;
        else colorScore += weight;
        if (hsl.lightness < 26) darkScore += weight;
        if (hsl.lightness > 76) lightScore += weight;
        if (hsl.saturation > 52 && hsl.lightness > 18 && hsl.lightness < 82) vividScore += weight;
        if (palette !== 'neutral') {
          colorSamples.push({
            palette,
            hsl,
            weight,
            hex: `#${[red, green, blue].map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`
          });
        }
      }

      const sortedBuckets = Object.entries(buckets).sort((a, b) => b[1] - a[1]);
      const [winner, winnerScore = 0] = sortedBuckets[0] || [];
      const totalScore = Object.values(buckets).reduce((sum, score) => sum + score, 0) || 1;
      const dominantSample = colorSamples.sort((a, b) => b.weight - a.weight)[0];
      const palette = winner || (sampled ? 'neutral' : '');
      const signal = {
        palette,
        style: palette ? inferStyleFromBrandSignal({
          palette,
          dominantHsl: dominantSample?.hsl,
          neutralShare: neutralScore / totalScore,
          darkShare: darkScore / totalScore,
          lightShare: lightScore / totalScore,
          vividShare: vividScore / Math.max(colorScore || totalScore, 1),
          contrastRange: maxLuma - minLuma
        }) : '',
        confidence: Math.min(1, winnerScore / totalScore),
        colors: colorSamples.slice(0, 4).map(sample => sample.hex),
        neutralShare: neutralScore / totalScore,
        contrastRange: maxLuma - minLuma
      };
      resolve(signal);
    } catch (error) {
      resolve({ palette: '', style: '', confidence: 0, colors: [] });
    }
  };
  image.onerror = () => resolve({ palette: '', style: '', confidence: 0, colors: [] });
  image.src = source;
});
