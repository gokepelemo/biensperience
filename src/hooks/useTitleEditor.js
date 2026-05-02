import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '../utilities/logger';

export default function useTitleEditor(planItem, canEdit, onUpdateTitle) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState('');
  const titleInputRef = useRef(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleClick = useCallback(() => {
    if (canEdit && onUpdateTitle) {
      setTitleText(planItem?.text || '');
      setIsEditingTitle(true);
    }
  }, [canEdit, onUpdateTitle, planItem?.text]);

  const handleTitleBlur = useCallback(async () => {
    setIsEditingTitle(false);
    const trimmedTitle = titleText.trim();
    if (trimmedTitle && trimmedTitle !== planItem?.text && onUpdateTitle) {
      try {
        await onUpdateTitle(trimmedTitle);
      } catch (error) {
        logger.error('[useTitleEditor] Failed to update title', { error });
        setTitleText(planItem?.text || '');
      }
    } else {
      setTitleText(planItem?.text || '');
    }
  }, [titleText, planItem?.text, onUpdateTitle]);

  const handleTitleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        titleInputRef.current?.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setTitleText(planItem?.text || '');
        setIsEditingTitle(false);
      }
    },
    [planItem?.text]
  );

  return {
    isEditingTitle,
    setIsEditingTitle,
    titleText,
    setTitleText,
    titleInputRef,
    handleTitleClick,
    handleTitleBlur,
    handleTitleKeyDown,
  };
}
