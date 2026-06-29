import { useMemo, useState } from 'react'
import { QuestionPanel } from '../components/QuestionPanel'
import { RankingTable } from '../components/RankingTable'
import { rounds } from '../data/rounds'
import { useGame } from '../state/useGame'
import type { AuditEvent, Student } from '../types/game'

type SortMode = 'number' | 'netWorth' | 'submitted'

const featureLabels: Record<string, string> = {
  betting: 'Betting',
  saving: 'Saving',
  interest: 'Interest',
  bankLoan: 'Bank loan',
  peerLoan: 'Peer loan',
  investment: 'Investment locked',
  insurance: 'Insurance locked',
}

function sortStudents(students: Student[], sortMode: SortMode) {
  return [...students].sort((a, b) => {
    if (sortMode === 'netWorth') {
      return b.netWorth - a.netWorth || a.number - b.number
    }
    if (sortMode === 'submitted') {
      return Number(a.submitted) - Number(b.submitted) || a.number - b.number
    }
    return a.number - b.number
  })
}

function formatAuditTime(event: AuditEvent) {
  return new Date(event.at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function TeacherPage() {
  const {
    currentRound,
    addRoundTime,
    finishGame,
    lockRound,
    nextRound,
    ranking,
    resetGame,
    releaseSlot,
    resolveBankLoan,
    resolvePeerLoan,
    revealRound,
    reopenRound,
    restartCurrentRound,
    session,
    settleRound,
    startRound,
    students,
    submittedCount,
    timeRemainingSeconds,
  } = useGame()
  const [sortMode, setSortMode] = useState<SortMode>('number')

  const sortedStudents = useMemo(
    () => sortStudents(students, sortMode),
    [sortMode, students],
  )
  const topThreeIds = new Set(ranking.slice(0, 3).map((student) => student.id))
  const canStart = session.status === 'waiting' || session.status === 'settled'

  return (
    <main className="page teacher-page">
      <section className="panel session-header">
        <div>
          <p className="eyebrow">Teacher Dashboard</p>
          <h1>{session.title}</h1>
          <p className="muted">
            Session {session.id}. The server controls money, loans, settlement,
            and ranking.
          </p>
        </div>
        <div className="session-stats">
          <div>
            <span>Status</span>
            <strong>{session.status}</strong>
          </div>
          <div>
            <span>Round</span>
            <strong>
              {currentRound.round} / {rounds.length}
            </strong>
          </div>
          <div>
            <span>Submitted</span>
            <strong>
              {submittedCount} / {students.length}
            </strong>
          </div>
          <div>
            <span>Time</span>
            <strong>{session.status === 'open' ? `${timeRemainingSeconds}s` : '-'}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Round Controls</p>
            <h2>Control Flow</h2>
          </div>
        </div>
        <div className="control-grid">
          <button disabled={!canStart} onClick={startRound} type="button">
            Start Round
          </button>
          <button disabled={session.status !== 'open'} onClick={() => addRoundTime(30)} type="button">
            +30 Seconds
          </button>
          <button
            disabled={session.status !== 'locked' && session.status !== 'revealed'}
            onClick={reopenRound}
            type="button"
          >
            Reopen Round
          </button>
          <button
            disabled={
              session.status !== 'open' &&
              session.status !== 'locked' &&
              session.status !== 'revealed'
            }
            onClick={restartCurrentRound}
            type="button"
          >
            Restart Current
          </button>
          <button disabled={session.status !== 'open'} onClick={lockRound} type="button">
            Lock Answers
          </button>
          <button disabled={session.status !== 'locked'} onClick={revealRound} type="button">
            Reveal Answer
          </button>
          <button disabled={session.status !== 'revealed'} onClick={settleRound} type="button">
            Settle Round
          </button>
          <button disabled={session.status !== 'settled'} onClick={nextRound} type="button">
            Next Round
          </button>
          <button disabled={session.status === 'finished'} onClick={finishGame} type="button">
            Finish Game
          </button>
          <button className="danger-button" onClick={resetGame} type="button">
            Reset Game
          </button>
        </div>
        {session.status === 'settled' ? (
          <div className="next-round-callout">
            <div>
              <strong>Round settled.</strong>
              <p>
                {currentRound.round >= rounds.length
                  ? 'Use Next Round to finish the game.'
                  : `Use Next Round to move from round ${currentRound.round} to round ${currentRound.round + 1}.`}
              </p>
            </div>
            <button className="primary-button" onClick={nextRound} type="button">
              Next Round
            </button>
          </div>
        ) : null}
        <div className="feature-row">
          {currentRound.allowedFeatures.map((feature) => (
            <span className="feature-pill" key={feature}>
              {featureLabels[feature]}
            </span>
          ))}
        </div>
      </section>

      <QuestionPanel
        correctVisible={session.status === 'revealed' || session.status === 'settled'}
        round={currentRound}
        disabled
      />

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Students</p>
            <h2>Submissions and Wallets</h2>
          </div>
          <label className="sort-label">
            Sort
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="number">Number</option>
              <option value="netWorth">Net Worth</option>
              <option value="submitted">Not Submitted</option>
            </select>
          </label>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Name</th>
                <th>Occupied</th>
                <th>Submitted</th>
                <th>Answer</th>
                <th>Bet</th>
                <th>Cash</th>
                <th>Savings</th>
                <th>Debt</th>
                <th>Net Worth</th>
                <th>Bankrupt</th>
                <th>Last Result</th>
                <th>Slot</th>
              </tr>
            </thead>
            <tbody>
              {sortedStudents.map((student) => {
                const rowClass = [
                  !student.submitted && session.status === 'open' ? 'needs-submit' : '',
                  student.bankrupt ? 'bankrupt-row' : '',
                  student.debt >= 50 ? 'high-debt' : '',
                  topThreeIds.has(student.id) ? 'top-rank' : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <tr className={rowClass} key={student.id}>
                    <td>{student.number}</td>
                    <td>{student.name}</td>
                    <td>{student.isOccupied ? 'Yes' : 'No'}</td>
                    <td>{student.submitted ? 'Yes' : 'No'}</td>
                    <td>{student.currentAnswer ?? '-'}</td>
                    <td>{student.currentBet ? `$${student.currentBet}` : '-'}</td>
                    <td>${student.cash}</td>
                    <td>${student.savings}</td>
                    <td>${student.debt}</td>
                    <td>
                      <strong>${student.netWorth}</strong>
                    </td>
                    <td>{student.bankrupt ? 'Yes' : 'No'}</td>
                    <td>{student.lastResult ?? '-'}</td>
                    <td>
                      <button
                        disabled={!student.isOccupied}
                        onClick={() => releaseSlot(student.id)}
                        type="button"
                      >
                        Release
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="split-layout">
        <RankingTable students={ranking} />
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Awards</p>
              <h2>Classroom Goals</h2>
            </div>
          </div>
          <ul className="award-list">
            <li>Highest Net Worth</li>
            <li>Best Saver</li>
            <li>Best Risk Manager</li>
            <li>Best Comeback</li>
            <li>Best English Speaker</li>
          </ul>
        </section>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Loans</p>
            <h2>Approval Queue</h2>
          </div>
        </div>

        <div className="loan-queue">
          <div>
            <h3>Bank Loans</h3>
            {session.bankLoanRequests.filter((request) => request.status === 'pending').length === 0 ? (
              <p className="muted">No pending bank loans.</p>
            ) : (
              session.bankLoanRequests
                .filter((request) => request.status === 'pending')
                .map((request) => {
                  const student = session.students[request.studentId]
                  return (
                    <article className="loan-item" key={request.id}>
                      <div>
                        <strong>{student?.name ?? request.studentId}</strong>
                        <p>
                          Borrow ${request.amount}, pay back ${request.payback}
                        </p>
                      </div>
                      <div className="loan-actions">
                        <button onClick={() => resolveBankLoan(request.id, true)} type="button">
                          Approve
                        </button>
                        <button className="danger-button" onClick={() => resolveBankLoan(request.id, false)} type="button">
                          Reject
                        </button>
                      </div>
                    </article>
                  )
                })
            )}
          </div>

          <div>
            <h3>Peer Loans</h3>
            {session.peerLoanRequests.filter((request) => request.status === 'pending').length === 0 ? (
              <p className="muted">No pending peer loans.</p>
            ) : (
              session.peerLoanRequests
                .filter((request) => request.status === 'pending')
                .map((request) => {
                  const borrower = session.students[request.borrowerId]
                  const lender = session.students[request.lenderId]
                  return (
                    <article className="loan-item" key={request.id}>
                      <div>
                        <strong>{borrower?.name ?? request.borrowerId}</strong>
                        <p>
                          From {lender?.name ?? request.lenderId}: ${request.amount},
                          pay back ${request.payback} by round {request.dueRound}
                        </p>
                      </div>
                      <div className="loan-actions">
                        <button onClick={() => resolvePeerLoan(request.id, true)} type="button">
                          Approve
                        </button>
                        <button className="danger-button" onClick={() => resolvePeerLoan(request.id, false)} type="button">
                          Reject
                        </button>
                      </div>
                    </article>
                  )
                })
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Audit</p>
            <h2>Activity and Integrity Log</h2>
          </div>
          <span className="status-pill">
            {session.auditLog.length} events
          </span>
        </div>

        <div className="audit-list">
          {session.auditLog.length === 0 ? (
            <p className="muted">No activity has been recorded yet.</p>
          ) : (
            session.auditLog.slice(0, 80).map((event) => (
              <article
                className={`audit-item ${event.severity}`}
                key={event.id}
              >
                <div>
                  <strong>{event.action.replaceAll('_', ' ')}</strong>
                  <p>{event.detail}</p>
                  {event.before && event.after ? (
                    <p className="audit-money">
                      Cash ${event.before.cash} to ${event.after.cash} |
                      Savings ${event.before.savings} to ${event.after.savings}
                      | Debt ${event.before.debt} to ${event.after.debt} | Net
                      worth ${event.before.netWorth} to ${event.after.netWorth}
                    </p>
                  ) : null}
                </div>
                <div className="audit-meta">
                  <span>{formatAuditTime(event)}</span>
                  <span>Round {event.round}</span>
                  <span>{event.actor}</span>
                  <span>{event.severity}</span>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  )
}
