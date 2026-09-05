import { useEffect, useRef, useState } from "react";
import type { EditorialQuiz } from "./workspace";
export function Preview({
  quiz,
  close,
}: {
  quiz: EditorialQuiz;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [hint, setHint] = useState(false);
  const question = quiz.questions[index];
  const originalClue =
    question?.reference.includes(" · Original clue (not a Bible quotation)") ??
    false;
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog ref={dialog} onCancel={close} className="preview-dialog">
      <div className="section-heading">
        <span className="muted">Player preview · unranked</span>
        <button
          aria-label="Close preview"
          className="icon-button"
          onClick={close}
        >
          ×
        </button>
      </div>
      <h2>{quiz.title || "Untitled quiz"}</h2>
      {question ? (
        <>
          <div className="preview-progress">
            <span
              style={{
                width: `${((index + 1) / quiz.questions.length) * 100}%`,
              }}
            />
          </div>
          <p className="muted">
            Question {index + 1} of {quiz.questions.length}
          </p>
          <h3>{question.prompt || "Your question will appear here."}</h3>
          <button className="hint-toggle" onClick={() => setHint(!hint)}>
            {hint ? "Hide Bible hint" : "Need a hint? Open your Bible clue"}
          </button>
          {hint &&
            (originalClue ? (
              <div className="preview-original-clue">
                <strong>Scripture-inspired clue</strong>
                <p>{question.hint || "Add a Bible hint in the editor."}</p>
                <cite>{question.reference}</cite>
              </div>
            ) : (
              <blockquote>
                {question.hint || "Add a Bible hint in the editor."}
                <cite>{question.reference}</cite>
              </blockquote>
            ))}
          <div className="preview-answers">
            {question.answers.map((a, i) => (
              <button
                className={`preview-answer ${answer !== null && i === question.correctIndex ? "right-answer" : ""} ${answer === i && i !== question.correctIndex ? "wrong-answer" : ""}`}
                key={i}
                disabled={answer !== null}
                onClick={() => setAnswer(i)}
              >
                <span>{String.fromCharCode(65 + i)}</span>
                {a || `Answer ${i + 1}`}
              </button>
            ))}
          </div>
          {answer !== null && (
            <p role="status">
              {answer === question.correctIndex
                ? "You got it!"
                : `The answer is ${question.answers[question.correctIndex]}.`}
            </p>
          )}
          <button
            className="primary full-width"
            onClick={() => {
              if (index === quiz.questions.length - 1) close();
              else {
                setIndex(index + 1);
                setAnswer(null);
                setHint(false);
              }
            }}
          >
            {index === quiz.questions.length - 1
              ? "Finish preview"
              : "Next question"}
          </button>
        </>
      ) : (
        <p>Add a question to preview your quiz.</p>
      )}
    </dialog>
  );
}
