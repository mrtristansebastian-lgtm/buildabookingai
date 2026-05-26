import { Crop, X } from 'lucide-react';
import { IMAGE_CROP_RATIOS } from '../../utils/imageCrop';

export function ImageCropModal({ crop, saving, onChange, onClose, onSave }) {
  if (!crop) return null;
  const preset = IMAGE_CROP_RATIOS[crop.ratioKey || 'square'] || IMAGE_CROP_RATIOS.square;

  return (
    <div className="image-crop-overlay" role="dialog" aria-modal="true">
      <div className="image-crop-sheet">
        <div className="image-crop-head">
          <div>
            <p>Image crop</p>
            <h3>{crop.title || 'Crop image'}</h3>
            <span>Position the image once, then save it cleanly across the app.</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close cropper">
            <X size={18} />
          </button>
        </div>

        <div className="image-crop-body">
          <div className="image-crop-preview">
            <div className={`image-crop-frame ${crop.shape === 'circle' ? 'is-circle' : ''}`} style={{ aspectRatio: preset.ratio }}>
              <img
                src={crop.source}
                alt=""
                style={{
                  objectPosition: `${crop.positionX || 50}% ${crop.positionY || 50}%`,
                  transform: `scale(${crop.zoom || 1})`
                }}
              />
            </div>
          </div>

          <div className="image-crop-controls">
            {[
              ['zoom', 'Zoom', 1, 2.2, 0.01],
              ['positionX', 'Horizontal position', 0, 100, 1],
              ['positionY', 'Vertical position', 0, 100, 1]
            ].map(([key, label, min, max, step]) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={crop[key] ?? (key === 'zoom' ? 1 : 50)}
                  onChange={(event) => onChange({ [key]: Number(event.target.value) })}
                />
              </label>
            ))}

            <div className="image-crop-actions">
              <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
              <button type="button" onClick={onSave} disabled={saving}>
                <Crop size={15} /> {saving ? 'Saving...' : 'Save Crop'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
