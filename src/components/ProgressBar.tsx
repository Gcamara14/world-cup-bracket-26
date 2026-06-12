interface ProgressBarProps {
  current: number
  total: number
  label: string
}

export function ProgressBar({ current, total, label }: ProgressBarProps) {
  const safeTotal = Math.max(total, 1)
  const percent = Math.min(100, Math.round((current / safeTotal) * 100))
  return (
    <header className="progress-header">
      <div className="progress-text">
        <strong>{label}</strong>
        <span>
          {current}/{total} complete
        </span>
      </div>
      <div className="progress-track" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <span className="progress-percent">{percent}%</span>
    </header>
  )
}
