import type { AnswerOption, Round } from '../types/game'

const answerLabels = ['A', 'B', 'C', 'D', 'E']

type QuestionPanelProps = {
  round: Round
  selectedAnswer?: AnswerOption | null
  correctVisible?: boolean
  onSelect?: (answer: AnswerOption) => void
  disabled?: boolean
}

export function QuestionPanel({
  round,
  selectedAnswer,
  correctVisible = false,
  onSelect,
  disabled = false,
}: QuestionPanelProps) {
  return (
    <section className="panel question-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Round {round.round}</p>
          <h2>English Question</h2>
        </div>
        {correctVisible ? (
          <span className="status-pill success">
            Answer {answerLabels[round.correctAnswer - 1]}
          </span>
        ) : null}
      </div>

      <pre className="question-text">{round.question}</pre>

      <div className="choice-grid">
        {round.choices.map((choice, index) => {
          const answer = (index + 1) as AnswerOption
          const isSelected = selectedAnswer === answer
          const isCorrect = correctVisible && round.correctAnswer === answer

          return (
            <button
              className={`choice-button ${isSelected ? 'selected' : ''} ${
                isCorrect ? 'correct' : ''
              }`}
              disabled={disabled}
              key={choice}
              onClick={() => onSelect?.(answer)}
              type="button"
            >
              <span>{answerLabels[index]}</span>
              {choice}
            </button>
          )
        })}
      </div>
    </section>
  )
}
