/**
 * BienBotPhotoGallery — Selectable photo grid for chat messages.
 *
 * Displayed inline in assistant messages when a `photo_gallery` structured
 * content block is present. Photos are sourced from Unsplash. Users can select
 * photos to add to their destination or experience.
 *
 * @module components/BienBotPanel/BienBotPhotoGallery
 */

import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Button, Text } from '../design-system';
import PhotoModal from '../PhotoModal/PhotoModal';
import styles from './BienBotPhotoGallery.module.css';

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function BienBotPhotoGallery({ data, onAddPhotos, disabled }) {
  const {
    photos = [],
    entity_type,
    entity_id,
    entity_name,
    selectable = false
  } = data || {};

  const [selected, setSelected] = useState(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);

  const handlePhotoClick = useCallback((index) => {
    if (selectable) {
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(index)) {
          next.delete(index);
        } else {
          next.add(index);
        }
        return next;
      });
    } else {
      setModalIndex(index);
      setModalOpen(true);
    }
  }, [selectable]);

  const handlePreview = useCallback((e, index) => {
    e.stopPropagation();
    setModalIndex(index);
    setModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  const handleAddSelected = useCallback(() => {
    if (selected.size === 0 || !onAddPhotos) return;
    const selectedPhotos = [...selected].map(i => photos[i]).filter(Boolean);
    onAddPhotos(selectedPhotos, entity_type, entity_id);
    setSelected(new Set());
  }, [selected, photos, onAddPhotos, entity_type, entity_id]);

  if (!photos.length) return null;

  // Build modal-compatible photo objects (PhotoModal expects url property)
  const modalPhotos = photos.map(p => ({
    ...p,
    url: p.url || p.thumb_url
  }));

  return (
    <div className={styles.gallery}>
      {entity_name && (
        <Text size="sm" className={styles.galleryTitle}>
          {selectable
            ? `Select photos to add to ${entity_name}`
            : `Photos for ${entity_name}`}
        </Text>
      )}

      <div className={styles.photoGrid}>
        {photos.map((photo, idx) => {
          const isSelected = selected.has(idx);
          const imgSrc = photo.thumb_url || photo.url;

          return (
            <button
              key={photo.unsplash_id || idx}
              type="button"
              className={`${styles.photoThumb} ${isSelected ? styles.photoThumbSelected : ''}`}
              onClick={() => handlePhotoClick(idx)}
              disabled={disabled}
              aria-label={photo.description || `Photo ${idx + 1}${photo.photographer ? ` by ${photo.photographer}` : ''}`}
              aria-pressed={selectable ? isSelected : undefined}
            >
              <img
                src={imgSrc}
                alt={photo.description || ''}
                className={styles.photoImage}
                loading="lazy"
              />
              {selectable && isSelected && (
                <span className={styles.selectedBadge}>
                  <CheckIcon />
                </span>
              )}
              {photo.photographer && (
                <span className={styles.attribution}>
                  {photo.photographer}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectable && selected.size > 0 && (
        <div className={styles.addActions}>
          <Button
            variant="primary"
            size="sm"
            onClick={handleAddSelected}
            disabled={disabled}
          >
            Add {selected.size} photo{selected.size !== 1 ? 's' : ''}
          </Button>
        </div>
      )}

      <Text size="xs" className={styles.unsplashCredit}>
        Photos from Unsplash
      </Text>

      {modalOpen && (
        <PhotoModal
          photos={modalPhotos}
          initialIndex={modalIndex}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

BienBotPhotoGallery.propTypes = {
  data: PropTypes.shape({
    photos: PropTypes.arrayOf(PropTypes.shape({
      unsplash_id: PropTypes.string,
      url: PropTypes.string.isRequired,
      thumb_url: PropTypes.string,
      description: PropTypes.string,
      photographer: PropTypes.string,
      photographer_url: PropTypes.string,
      width: PropTypes.number,
      height: PropTypes.number
    })),
    entity_type: PropTypes.string,
    entity_id: PropTypes.string,
    entity_name: PropTypes.string,
    total_count: PropTypes.number,
    selectable: PropTypes.bool
  }),
  onAddPhotos: PropTypes.func,
  disabled: PropTypes.bool
};
