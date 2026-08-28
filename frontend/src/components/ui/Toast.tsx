import './Toast.css';

type ToastProps = {
  message: string;
  tone?: 'success' | 'error';
  onClose: () => void;
};

export function Toast({ message, tone = 'success', onClose }: ToastProps) {
  if (!message) {
    return null;
  }

  return (
    <div className={`toast toast--${tone}`} role="status">
      <p>{message}</p>
      <button type="button" onClick={onClose} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
