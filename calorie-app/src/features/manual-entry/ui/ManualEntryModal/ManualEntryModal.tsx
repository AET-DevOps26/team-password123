import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../../../shared/ui/Modal/Modal';
import { useManualEntry } from '../../model/useManualEntry';
import type { MealSlot } from '../../model/useManualEntry';
import styles from './ManualEntryModal.module.css';

interface ManualEntryModalProps {
  onClose: () => void;
  onAdded: (kcal: number) => void;
  defaultSlot?: MealSlot;
  loggedAt?: Date;
}

const SLOTS: MealSlot[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export function ManualEntryModal({ onClose, onAdded, defaultSlot, loggedAt }: ManualEntryModalProps) {
  const entry = useManualEntry(defaultSlot, loggedAt);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function pickPhoto(file: File) {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    entry.setPhoto(file);
  }

  function clearPhoto() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    entry.clearPhoto();
  }

  // Release the preview blob URL when the modal unmounts (e.g. after a save).
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function handleSave() {
    const kcal = await entry.save();
    onAdded(kcal);
  }

  const footer = (
    <>
      <div className={styles.totalBlock}>
        <span className={styles.totalLabel}>Total</span>
        <b className={styles.totalValue}>{entry.totalCalories} kcal</b>
      </div>
      <button
        className={`${styles.btn} ${styles.primary} ${styles.grow}`}
        disabled={!entry.canSave}
        onClick={handleSave}
      >
        <CheckIcon /> Save to diary
      </button>
    </>
  );

  return (
    <Modal title="Add ingredients" onClose={onClose} footer={footer} narrow>
      <p className={styles.hint}>
        For home-made meals, type ingredients for 100% accuracy.
      </p>

      {/* Photo (optional) */}
      <div className={styles.photoRow}>
        {entry.photoFile && previewUrl ? (
          <div className={styles.photoPreview}>
            <img src={previewUrl} alt="Meal" className={styles.photoThumb} />
            <button className={styles.photoRemove} onClick={clearPhoto} aria-label="Remove photo" type="button">
              <CloseIcon />
            </button>
          </div>
        ) : (
          <button className={styles.photoAdd} onClick={() => fileInputRef.current?.click()} type="button">
            <CameraIcon /> Add a photo <span className={styles.photoOpt}>(optional)</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) pickPhoto(f); }}
        />
      </div>

      {/* Search */}
      <div className={styles.searchField}>
        <SearchIcon />
        <input
          value={entry.query}
          onChange={(e) => entry.setQuery(e.target.value)}
          placeholder="Search a food or brand…"
          className={styles.searchInput}
          autoFocus
        />
      </div>

      {/* Suggestions */}
      {entry.query.trim() && (
        <div className={styles.suggestList}>
          {entry.suggestions.length > 0 ? (
            entry.suggestions.map((s) => (
              <button
                key={s.name}
                className={styles.suggestRow}
                onClick={() => entry.addIngredient(s)}
              >
                <span><b>{s.name}</b> · {s.amount}</span>
                <span className={styles.suggestCal}>{s.calories} kcal <PlusIcon /></span>
              </button>
            ))
          ) : (
            <div className={styles.suggestEmpty}>
              No quick match — "{entry.query}" will be estimated by AI.
            </div>
          )}
        </div>
      )}

      {/* Meal slot selector */}
      <div className={styles.slotRow}>
        <span className={styles.slotLabel}>Meal</span>
        <div className={styles.slotTabs}>
          {SLOTS.map((s) => (
            <button
              key={s}
              className={`${styles.slotTab} ${entry.slot === s ? styles.slotTabActive : ''}`}
              onClick={() => entry.setSlot(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Ingredients list */}
      {entry.items.length > 0 && (
        <>
          <div className={styles.listHead}>
            <span>Your ingredients</span>
            <span className={styles.listCount}>{entry.items.length}</span>
          </div>
          <div className={styles.itemList}>
            {entry.items.map((item, i) => (
              <div key={i} className={styles.item}>
                <div className={styles.itemBody}>
                  <div className={styles.itemName}>{item.name}</div>
                  <div className={styles.itemAmt}>{item.amount}</div>
                </div>
                <div className={styles.itemCal}>{item.calories} kcal</div>
                <button
                  className={styles.itemRemove}
                  onClick={() => entry.removeIngredient(i)}
                  aria-label="Remove"
                >
                  <CloseIcon />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

/* ── Icons ── */
function SearchIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="6" /><path d="M16 16l4 4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5 10 17.5 19 6.5" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.1-1.8a1 1 0 0 1 .9-.5h6.6a1 1 0 0 1 .9.5L17.3 7h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
