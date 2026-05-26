export const editorPreviewFrames = {
  desktop: {
    full: { width: 1100, height: 720, maxScale: 0.84, minScale: 0.28, paddingX: 150, paddingY: 160 },
    compact: { width: 900, height: 380, maxScale: 0.92, minScale: 0.26, paddingX: 22, paddingY: 118 }
  },
  mobile: {
    full: { width: 470, height: 880, maxScale: 0.82, minScale: 0.28, paddingX: 96, paddingY: 146 },
    compact: { width: 360, height: 520, maxScale: 0.82, minScale: 0.3, paddingX: 20, paddingY: 106 }
  }
};

export const getEditorPreviewFrame = (device, compact) => {
  const frameSet = editorPreviewFrames[device] || editorPreviewFrames.desktop;
  return frameSet[compact ? 'compact' : 'full'];
};
