import { ScripturePreview } from "./ScripturePreview";
import type { Question } from '@bivia/core';
export function QuestionEditor({ question, index, update, remove }: { question: Question; index: number; update: (question: Question) => void; remove: () => void }) {
  return <section className="question-editor">
    <div className="section-heading"><h3>Question {String(index + 1).padStart(2, '0')}</h3><button className="text-button danger" onClick={remove}>Remove question</button></div>
    <label>Question<textarea value={question.prompt} onChange={e => update({ ...question, prompt: e.target.value })} placeholder="What would you like to ask?" rows={2}/></label>
    <fieldset><legend>Answers <span>Choose the correct answer</span></legend><div className="answer-grid">{question.answers.map((answer, a) => <div className={`answer-input ${question.correctIndex === a ? 'correct' : ''}`} key={a}><input aria-label={`Answer ${String.fromCharCode(65 + a)} is correct for question ${index + 1}`} type="radio" name={`correct-${question.id}`} checked={question.correctIndex === a} onChange={() => update({ ...question, correctIndex: a })}/><input aria-label={`Question ${index + 1} answer ${String.fromCharCode(65 + a)}`} value={answer} placeholder={`Answer ${String.fromCharCode(65 + a)}`} onChange={e => update({ ...question, answers: question.answers.map((v, n) => n === a ? e.target.value : v) })}/></div>)}</div></fieldset>
    <div className="hint-editor"><div className="hint-label">A little biblical inspiration</div><label>Bible hint<textarea value={question.hint} onChange={e => update({ ...question, hint: e.target.value })} placeholder="A verse that points toward the answer…" rows={2}/></label><label>Reference<input value={question.reference} onChange={e => update({ ...question, reference: e.target.value })} placeholder="Book chapter:verse · translation"/></label></div>
    <ScripturePreview key={question.reference} reference={question.reference} />
  </section>;
}
