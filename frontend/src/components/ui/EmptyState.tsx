import './FeedbackStates.css';

type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="feedback-state feedback-state--empty">
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
