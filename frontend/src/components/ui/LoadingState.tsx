import './FeedbackStates.css';

type LoadingStateProps = {
  message?: string;
};

export function LoadingState({ message = 'Loading…' }: LoadingStateProps) {
  return (
    <div className="feedback-state" role="status">
      <div className="feedback-state__spinner" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
