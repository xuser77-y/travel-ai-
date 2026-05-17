import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import './ImageLightbox.css';

/**
 * Lightweight, dependency-free image preview.
 *
 * Mounts a full-screen dimmed overlay with the image centred. Closes on:
 * - clicking the dimmed backdrop,
 * - clicking the close button,
 * - pressing Escape.
 *
 * The image itself swallows clicks so accidentally hitting the photo
 * doesn't dismiss the preview.
 */
const ImageLightbox = ({ src, alt = '', onClose }) => {
  // Close on Escape and lock body scroll while open.
  useEffect(() => {
    if (!src) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div className="img-lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <button
        type="button"
        className="img-lightbox-close"
        onClick={onClose}
        aria-label="Close preview"
      >
        <X size={20} />
      </button>
      <img
        src={src}
        alt={alt}
        className="img-lightbox-image"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

export default ImageLightbox;
