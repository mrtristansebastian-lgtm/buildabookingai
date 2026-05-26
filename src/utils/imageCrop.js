export const IMAGE_CROP_RATIOS = {
  square: { ratio: '1 / 1', width: 900, height: 900 },
  banner: { ratio: '16 / 7', width: 1600, height: 700 },
  gallery: { ratio: '4 / 3', width: 1200, height: 900 },
  wide: { ratio: '16 / 9', width: 1600, height: 900 }
};

export const loadImageForCrop = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

export const buildCroppedImageFile = async (crop) => {
  const preset = IMAGE_CROP_RATIOS[crop?.ratioKey || 'square'] || IMAGE_CROP_RATIOS.square;
  const image = await loadImageForCrop(crop.source);
  const canvas = document.createElement('canvas');
  canvas.width = preset.width;
  canvas.height = preset.height;
  const ctx = canvas.getContext('2d');
  const zoom = Math.max(1, Number(crop.zoom || 1));
  const coverScale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight) * zoom;
  const drawWidth = image.naturalWidth * coverScale;
  const drawHeight = image.naturalHeight * coverScale;
  const offsetX = Math.max(0, drawWidth - canvas.width) * (Number(crop.positionX || 50) / 100);
  const offsetY = Math.max(0, drawHeight - canvas.height) * (Number(crop.positionY || 50) / 100);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, -offsetX, -offsetY, drawWidth, drawHeight);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!blob) throw new Error('Could not crop image.');
  const cleanName = String(crop.fileName || 'image.jpg').replace(/\.[a-z0-9]+$/i, '');
  return new File([blob], `${cleanName || 'image'}-cropped.jpg`, { type: 'image/jpeg' });
};
