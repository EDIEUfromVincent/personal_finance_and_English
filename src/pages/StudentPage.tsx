import { useMemo, useState } from 'react'
import { BET_AMOUNTS, LOAN_AMOUNTS, SAVING_AMOUNTS } from '../data/constants'
import { QuestionPanel } from '../components/QuestionPanel'
import { useGame } from '../state/useGame'
import type { AnswerOption, LoanAmount } from '../types/game'
import { canBet, calculateInterest, getBankLoanPayback } from '../utils/finance'

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
    requestBankLoan,
    requestPeerLoan,
  } = useGame()
  const student = students.find((item) => item.id === studentId)
  const [answer, setAnswer] = useState<AnswerOption | null>(null)
  const [bet, setBet] = useState<number | null>(null)
  const [customBet, setCustomBet] = useState('')
  const [peerLenderId, setPeerLenderId] = useState('')
  const [peerAmount, setPeerAmount] = useState<LoanAmount>(10)
  const [message, setMessage] = useState('')

  const selectedStudent = useMemo(() => student, [student])
  const canAct =
    session.status === 'open' &&
    timeRemainingSeconds > 0 &&
    !selectedStudent?.submitted
  const savingsEnabled = currentRound.allowedFeatures.includes('saving')
  const interestEnabled = currentRound.allowedFeatures.includes('interest')
  const bankLoanEnabled = currentRound.allowedFeatures.includes('bankLoan')
  const peerLoanEnabled = currentRound.allowedFeatures.includes('peerLoan')
  const revealed = session.status === 'revealed' || session.status === 'settled'
  const canUseFinance =
    session.status === 'open' && timeRemainingSeconds > 0 && !selectedStudent?.submitted
  const canUseCustomBet =
    (selectedStudent?.cash ?? 0) + (selectedStudent?.debt ?? 0) >= 100 &&
    canAct
  const peerPayback = peerAmount + Math.ceil(peerAmount * 0.25)

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
  const askBankLoan = async (amount: LoanAmount) => {
    const result = await requestBankLoan(selectedStudent.id, amount)
    setMessage(result.message)
  }
  const askPeerLoan = async () => {
    if (!peerLenderId) {
      setMessage('Choose a lender first.')
      return
    }
    const result = await requestPeerLoan(selectedStudent.id, peerLenderId, peerAmount)
    setMessage(result.message)
  }
  const availableLenders = students.filter(
    (item) => item.id !== selectedStudent.id && item.isOccupied,
  )
  const selectedPeerLender = availableLenders.find(
    (lender) => lender.id === peerLenderId,
  )
  const pendingPeerLoan = session.peerLoanRequests.find(
    (request) =>
      request.borrowerId === selectedStudent.id && request.status === 'pending',
  )
  const bankLoansTaken = session.bankLoanRequests.filter(
    (request) =>
      request.studentId === selectedStudent.id && request.status === 'approved',
  )
  const pendingPeerLenderName = pendingPeerLoan
    ? (students.find((item) => item.id === pendingPeerLoan.lenderId)?.name ??
      'classmate')
    : ''
  const lentPeerLoans = session.peerLoanRequests.filter(
    (request) =>
      request.lenderId === selectedStudent.id && request.status === 'approved',
  )
  const borrowedPeerLoans = session.peerLoanRequests.filter(
    (request) =>
      request.borrowerId === selectedStudent.id && request.status === 'approved',
  )
  const lenderHasEnoughCash =
    !selectedPeerLender || selectedPeerLender.cash >= peerAmount

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
            <span className="status-pill">Next +${calculateInterest(selectedStudent.savings)}</span>
          ) : null}
        </div>

        {savingsEnabled ? (
          <>
            <p className="muted">
              {selectedStudent.submitted
                ? 'Finance actions close after submitting.'
                : 'Savings earn 10% compound interest when the class moves to the next round.'}
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
          <p className="muted">Saving opens in round 3.</p>
        )}

        {bankLoanEnabled ? (
          <div className="finance-subpanel">
            <div className="panel-heading compact-heading">
              <div>
                <p className="eyebrow">Bank Loan</p>
                <h3>Instant Borrowing</h3>
              </div>
            </div>
            <p className="muted">
              Cash increases immediately. Debt already includes the payback
              amount.
            </p>
            <p className="finance-note">
              Bank loans used: {selectedStudent.loanCount} / 2
              {bankLoansTaken.length > 0
                ? ` · latest payback $${bankLoansTaken[0].payback}`
                : ''}
            </p>
            {selectedStudent.loanCount >= 2 ? (
              <p className="message">Bank loan limit reached.</p>
            ) : null}
            <div className="finance-actions">
              {LOAN_AMOUNTS.map((amount) => (
                <button
                  disabled={!canUseFinance || selectedStudent.loanCount >= 2}
                  key={`bank-${amount}`}
                  onClick={() => askBankLoan(amount)}
                  type="button"
                >
                  <span>Borrow ${amount}</span>
                  <small>Pay back ${getBankLoanPayback(amount)}</small>
                </button>
              ))}
            </div>
            <div className="student-loan-ledger">
              <div>
                <h4>Teacher Bank Loans</h4>
                {bankLoansTaken.length === 0 ? (
                  <p className="muted">No bank loans yet.</p>
                ) : (
                  <div className="debt-list">
                    {bankLoansTaken.map((loan) => {
                      const interest = loan.payback - loan.amount
                      return (
                        <article className="debt-item compact-debt-item" key={loan.id}>
                          <div>
                            <strong>Teacher Bank</strong>
                            <p>lent you ${loan.amount}</p>
                          </div>
                          <div className="debt-meta">
                            <span>Interest ${interest}</span>
                            <span>You owe ${loan.payback}</span>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {peerLoanEnabled ? (
          <div className="finance-subpanel">
            <div className="panel-heading compact-heading">
              <div>
                <p className="eyebrow">Peer Loan</p>
                <h3>Borrow From Classmate</h3>
              </div>
            </div>
            <p className="muted">
              Peer loans need teacher approval because money moves from another
              occupied student.
            </p>
            {pendingPeerLoan ? (
              <p className="finance-note">
                Pending: ${pendingPeerLoan.amount} from {pendingPeerLenderName},
                pay back ${pendingPeerLoan.payback}.
              </p>
            ) : null}
            <label>
              Lender
              <select
                disabled={
                  !canUseFinance ||
                  availableLenders.length === 0 ||
                  Boolean(pendingPeerLoan)
                }
                onChange={(event) => setPeerLenderId(event.target.value)}
                value={peerLenderId}
              >
                <option value="">Choose lender</option>
                {availableLenders.map((lender) => (
                  <option key={lender.id} value={lender.id}>
                    {lender.number}. {lender.name} (${lender.cash})
                  </option>
                ))}
              </select>
            </label>
            {availableLenders.length === 0 ? (
              <p className="message">No occupied classmates can lend yet.</p>
            ) : null}
            {!lenderHasEnoughCash ? (
              <p className="message">
                That lender only has ${selectedPeerLender?.cash}. Choose a
                smaller amount or another lender.
              </p>
            ) : null}
            <div className="finance-actions">
              {LOAN_AMOUNTS.map((amount) => (
                <button
                  className={peerAmount === amount ? 'selected amount-button' : ''}
                  disabled={!canUseFinance || Boolean(pendingPeerLoan)}
                  key={`peer-${amount}`}
                  onClick={() => setPeerAmount(amount)}
                  type="button"
                >
                  ${amount}
                </button>
              ))}
            </div>
            <button
              className="secondary-button full-width"
              disabled={
                !canUseFinance ||
                !peerLenderId ||
                Boolean(pendingPeerLoan) ||
                !lenderHasEnoughCash
              }
              onClick={askPeerLoan}
              type="button"
            >
              Request Peer Loan · Pay back ${peerPayback}
            </button>
            <div className="student-loan-ledger">
              <div>
                <h4>Money I Lent</h4>
                {lentPeerLoans.length === 0 ? (
                  <p className="muted">No classmates have borrowed from you yet.</p>
                ) : (
                  <div className="debt-list">
                    {lentPeerLoans.map((loan) => {
                      const borrower = students.find(
                        (item) => item.id === loan.borrowerId,
                      )
                      return (
                        <article className="debt-item compact-debt-item" key={loan.id}>
                          <div>
                            <strong>{borrower?.name ?? loan.borrowerId}</strong>
                            <p>borrowed ${loan.amount} from you</p>
                          </div>
                          <div className="debt-meta">
                            <span>Pay back ${loan.payback}</span>
                            <span>Round {loan.dueRound}</span>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </div>

              <div>
                <h4>Money I Borrowed</h4>
                {borrowedPeerLoans.length === 0 ? (
                  <p className="muted">No approved peer loans yet.</p>
                ) : (
                  <div className="debt-list">
                    {borrowedPeerLoans.map((loan) => {
                      const lender = students.find(
                        (item) => item.id === loan.lenderId,
                      )
                      return (
                        <article className="debt-item compact-debt-item" key={loan.id}>
                          <div>
                            <strong>{lender?.name ?? loan.lenderId}</strong>
                            <p>lent you ${loan.amount}</p>
                          </div>
                          <div className="debt-meta">
                            <span>You owe ${loan.payback}</span>
                            <span>Round {loan.dueRound}</span>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}
