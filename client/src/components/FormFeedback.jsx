// Inline success/error line shown beneath a form's submit button.
export default function FormFeedback({ feedback }) {
  if (!feedback) {
    return null;
  }

  return (
    <p className={`feedback feedback--${feedback.type}`} role="status" aria-live="polite">
      {feedback.message}
    </p>
  );
}
