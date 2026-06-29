import { useMemo, useState } from 'react'
import { BET_AMOUNTS, SAVING_AMOUNTS } from '../data/constants'
import { QuestionPanel } from '../components/QuestionPanel'
import { useGame } from '../state/useGame'
import type { AnswerOption } from '../types/game'
import { canBet, calculateInterest } from '../utils/finance'

type StudentPageProps = {
  studentId: string
}

export function StudentPage({ studentId }: StudentPageProps) {
  const {
    currentRound,
    clientId,
    session,
    students,
    timeRemainingSeconds,
    submitAnswer,
    saveMoney,
    withdrawSavings,
  } = useGame()
  const student = students.find((item) => item.id === studentId)
  const [answer, setAnswer] = useState<AnswerOption | null>(null)
  const [bet, setBet] = useState<number | null>(null)
  const [customBet, setCustomBet] = useState('')
  const [message, setMessage] = useState('')

  const selectedStudent = useMemo(() => student, [student])
  const canAct =
    session.status === 'open' &&
    timeRemainingSeconds > 0 &&
    !selectedStudent?.submitted
  const savingsEnabled = currentRound.allowedFeatures.includes('saving')
  const interestEnabled = currentRound.allowedFeatures.includes('interest')
  const revealed = session.status === 'revealed' || session.status === 'settled'
  const canUseFinance =
    session.status === 'open' && timeRemainingSeconds > 0 && !selectedStudent?.submitted
  const canUseCustomBet =
    (selectedStudent?.cash ?? 0) + (selectedStudent?.debt ?? 0) >= 100 &&
    canAct

  if (!selectedStudent) {
    return (
      <main className="page narrow-page">
        <section className="panel">
          <h1>Student slot not found</h1>
          <a className="secondary-button" href="/student">
            Back to Join
          </a>
        </section>
      </main>
    )
  }

  if (!selectedStudent.isOccupied || selectedStudent.claimedBy !== clientId) {
    return (
      <main className="page narrow-page">
        <section className="panel join-panel">
          <p className="eyebrow">Slot Locked</p>
          <h1>Choose Your Slot First</h1>
          <p className="muted">
            Student {selectedStudent.number} is not claimed by this device. Ask
            your teacher to release it if someone chose it by mistake.
          </p>
          <a className="primary-button full-width" href="/student">
            Back to Student Join
          </a>
        </section>
      </main>
    )
  }

  const submit = async () => {
    if (!answer || !bet) return
    const result = await submitAnswer(selectedStudent.id, answer, bet)
    setMessage(result.message)
  }

  const finance = async (kind: 'save' | 'withdraw', amount: 10 | 20 | 30 | 50) => {
    const result =
      kind === 'save'
        ? await saveMoney(selectedStudent.id, amount)
        : await withdrawSavings(selectedStudent.id, amount)
    setMessage(result.message)
  }

  const resultLabel =
    selectedStudent.lastResult === 'correct'
      ? 'Correct'
      : selectedStudent.lastResult === 'wrong'
        ? 'Wrong'
        : selectedStudent.lastResult === 'none'
          ? 'No submission'
          : 'Pending'

  return (
    <main className="page student-layout">
      <section className="panel wallet-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Student {selectedStudent.number}</p>
            <h1>{selectedStudent.name}</h1>
          </div>
          <span className={`status-pill ${session.status}`}>{session.status}</span>
        </div>

        <div className="wallet-grid">
          <div>
            <span>Cash</span>
            <strong>${selectedStudent.cash}</strong>
          </div>
          <div>
            <span>Savings</span>
            <strong>${selectedStudent.savings}</strong>
          </div>
          <div>
            <span>Debt</span>
            <strong>${selectedStudent.debt}</strong>
          </div>
          <div>
            <span>Net Worth</span>
            <strong>${selectedStudent.netWorth}</strong>
          </div>
        </div>

        <div className="result-strip">
          <span>Time: {session.status === 'open' ? `${timeRemainingSeconds}s` : '-'}</span>
          <span>Submitted: {selectedStudent.submitted ? 'Yes' : 'No'}</span>
          <span>Last Result: {resultLabel}</span>
        </div>
      </section>

      <QuestionPanel
        correctVisible={revealed}
        disabled={!canAct}
        onSelect={setAnswer}
        round={currentRound}
        selectedAnswer={answer ?? selectedStudent.currentAnswer}
      />

      <section className="panel controls-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Answer and Bet</p>
            <h2>Choose Classroom Money Risk</h2>
          </div>
        </div>

        <div className="bet-grid">
          {BET_AMOUNTS.map((amount) => (
            <button
              className={bet === amount ? 'selected amount-button' : 'amount-button'}
              disabled={!canAct || !canBet(selectedStudent, amount)}
              key={amount}
              onClick={() => {
                setCustomBet('')
                setBet(amount)
              }}
              type="button"
            >
              ${amount}
            </button>
          ))}
        </div>

        {canUseCustomBet ? (
          <label className="custom-bet-label">
            Custom Bet
            <input
              inputMode="numeric"
              min={1}
              onChange={(event) => {
                const next = event.target.value.replace(/\D/g, '')
                setCustomBet(next)
                setBet(next ? Number(next) : null)
              }}
              placeholder="Type amount"
              type="text"
              value={customBet}
            />
          </label>
        ) : null}

        <button
          className="primary-button full-width"
          disabled={!answer || !bet || !canAct || !canBet(selectedStudent, bet)}
          onClick={submit}
          type="button"
        >
          Submit Answer
        </button>
        {session.status === 'open' && timeRemainingSeconds === 0 ? (
          <p className="message">Time is up. Ask your teacher for more time.</p>
        ) : null}
        {message ? <p className="message">{message}</p> : null}
      </section>

      <section className="panel finance-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Finance</p>
            <h2>Saving Tools</h2>
          </div>
          {interestEnabled ? (
            <span className="status-pill">Interest {calculateInterest(selectedStudent.savings)}</span>
          ) : null}
        </div>

        {savingsEnabled ? (
          <>
            <p className="muted">
              {selectedStudent.submitted
                ? 'Finance actions close after submitting.'
                : 'Move Classroom Money between cash and savings while the round is open.'}
            </p>
            <div className="finance-actions">
              {SAVING_AMOUNTS.map((amount) => (
                <button
                  disabled={!canUseFinance || selectedStudent.cash < amount}
                  key={`save-${amount}`}
                  onClick={() => finance('save', amount)}
                  type="button"
                >
                  Save ${amount}
                </button>
              ))}
            </div>
            <div className="finance-actions">
              {SAVING_AMOUNTS.map((amount) => (
                <button
                  disabled={!canUseFinance || selectedStudent.savings < amount}
                  key={`withdraw-${amount}`}
                  onClick={() => finance('withdraw', amount)}
                  type="button"
                >
                  Withdraw ${amount}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="muted">Saving opens in round 3. Loans, investments, and insurance are not in Phase 1.</p>
        )}
      </section>
    </main>
  )
}
