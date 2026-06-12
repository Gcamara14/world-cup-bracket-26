interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({ open, title, description, onCancel, onConfirm }: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        <p>{description}</p>
        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="danger-btn" onClick={onConfirm}>
            Confirm Reset
          </button>
        </div>
      </div>
    </div>
  )
}
