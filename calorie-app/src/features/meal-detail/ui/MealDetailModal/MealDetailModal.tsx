import { useState } from 'react';
import { Modal } from '../../../../shared/ui/Modal/Modal';
import type { MealEntry, MealSlot } from '../../../../entities/meal';
import { useMealPhoto } from '../../../../entities/meal/lib/useMealPhoto';
import { useMealDetail } from '../../model/useMealDetail';
import styles from './MealDetailModal.module.css';

interface MealDetailModalProps {
  meal: MealEntry;
  onClose: () => void;
  onSaved?: () => void;
  onDeleted?: () => void;
}

const SLOTS: MealSlot[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export function MealDetailModal({ meal, onClose, onSaved, onDeleted }: MealDetailModalProps) {
  const detail = useMealDetail(meal);
  const photoSrc = useMealPhoto(meal.imageUrl);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave() {
    const ok = await detail.save();
    if (ok) {
      onSaved?.();
      onClose();
    }
  }

  async function handleDelete() {
    const ok = await detail.remove();
    if (ok) {
      onDeleted?.();
      onClose();
    }
  }

  const footer = confirmDelete ? (
    <div className={styles.confirmDelete}>
      <p className={styles.confirmText}>
        Delete <strong>{detail.name.trim() || meal.name}</strong>? This cannot be undone.
      </p>
      <div className={styles.confirmActions}>
        <button
          className={`${styles.btn} ${styles.ghost}`}
          onClick={() => setConfirmDelete(false)}
          disabled={detail.deleting}
          type="button"
        >
          Cancel
        </button>
        <button
          className={`${styles.btn} ${styles.dangerSolid}`}
          onClick={handleDelete}
          disabled={detail.deleting}
          type="button"
        >
          {detail.deleting ? 'Deleting…' : 'Delete meal'}
        </button>
      </div>
    </div>
  ) : (
    <div className={styles.footer}>
      <button
        className={`${styles.btn} ${styles.danger}`}
        onClick={() => setConfirmDelete(true)}
        disabled={detail.saving || detail.loading}
        type="button"
      >
        Delete
      </button>
      <button
        className={`${styles.btn} ${styles.primary}`}
        onClick={handleSave}
        disabled={!detail.canSave}
        type="button"
      >
        {detail.saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );

  return (
    <Modal title="Meal details" onClose={onClose} footer={footer} narrow>
      <div className={styles.meta}>
        <span className={styles.time}>{meal.time}</span>
        {!detail.persisted && (
          <span className={styles.time}>· not synced to server</span>
        )}
      </div>

      <div className={styles.photoWrap}>
        {photoSrc
          ? <img src={photoSrc} alt={detail.name || meal.name} className={styles.photo} />
          : <span className={styles.photoPlaceholder}>No photo</span>}
      </div>

      {detail.loading ? (
        <div className={styles.loading}>Loading meal…</div>
      ) : (
        <div className={styles.fields}>
          <label className={styles.fieldLabel}>
            Name
            <input
              className={styles.fieldInput}
              value={detail.name}
              onChange={(e) => detail.setName(e.target.value)}
              placeholder="Meal name"
            />
          </label>

          <label className={styles.fieldLabel}>
            Meal slot
            <select
              className={styles.slotSelect}
              value={detail.slot}
              onChange={(e) => detail.setSlot(e.target.value as MealSlot)}
            >
              {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label className={styles.fieldLabel}>
            Calories (kcal)
            <input
              className={styles.fieldInput}
              type="number"
              min={0}
              value={detail.calories}
              onChange={(e) => detail.setCalories(e.target.value)}
            />
          </label>

          <div className={styles.macroRow}>
            {([
              ['Protein', detail.protein, detail.setProtein],
              ['Carbs', detail.carbs, detail.setCarbs],
              ['Fat', detail.fat, detail.setFat],
            ] as const).map(([label, value, setValue]) => (
              <label key={label} className={styles.fieldLabel}>
                {label} (g)
                <input
                  className={styles.fieldInput}
                  type="number"
                  min={0}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {detail.error && <p className={styles.error}>{detail.error}</p>}
    </Modal>
  );
}
