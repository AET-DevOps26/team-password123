import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import styles from './PhotoUpload.module.css';
import type { MealAnalysisResponse, ApiError } from '../../types';
import { mealApi } from '../../api/mealApi';

interface PhotoUploadProps {
  onAnalysisComplete: (result: MealAnalysisResponse) => void;
}

export function PhotoUpload({ onAnalysisComplete }: PhotoUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Accept a file — validate type and create a preview URL
  function handleFile(file: File) {
    setErrorMessage(null);

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload an image file (JPG, PNG, WEBP, etc.)');
      return;
    }

    // 10 MB limit
    const MAX_SIZE_MB = 10;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setErrorMessage(`File is too large. Maximum size is ${MAX_SIZE_MB} MB.`);
      return;
    }

    setSelectedFile(file);

    // Create a temporary URL for the preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  }

  // Click on the drop zone — open the file picker dialog
  function handleDropzoneClick() {
    fileInputRef.current?.click();
  }

  // User selected a file through the dialog
  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  // Drag & Drop handlers
  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  // Clear the selected photo
  function handleReset() {
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  // Send the photo for analysis
  async function handleAnalyze() {
    if (!selectedFile) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await mealApi.analyzePhoto(selectedFile);
      onAnalysisComplete(result);
    } catch (err) {
      const apiErr = err as ApiError;
      setErrorMessage(apiErr.message ?? 'An error occurred during analysis. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  const dropzoneClasses = [
    styles.dropzone,
    isDragOver ? styles.dropzoneActive : '',
    previewUrl ? styles.dropzoneWithImage : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.container}>
      <div
        className={dropzoneClasses}
        onClick={!previewUrl ? handleDropzoneClick : undefined}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Selected dish"
            className={styles.preview}
          />
        ) : (
          <>
            <p className={styles.hint}>
              <strong>Click</strong> or drag a photo here
            </p>
            <p className={styles.hint}>JPG, PNG, WEBP — up to 10 MB</p>
          </>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        onChange={handleInputChange}
      />

      {errorMessage && (
        <p className={styles.error}>{errorMessage}</p>
      )}

      {/* Buttons — shown only when a photo is selected */}
      {selectedFile && (
        <>
          <button
            className={styles.analyzeButton}
            onClick={handleAnalyze}
            disabled={isLoading}
          >
            {isLoading ? 'Analyzing...' : 'Count Calories'}
          </button>

          <button className={styles.resetButton} onClick={handleReset}>
            Choose a different photo
          </button>
        </>
      )}
    </div>
  );
}
