import { rounds } from '../data/rounds'
import type {
  AuditEvent,
  AnswerOption,
  BetAmount,
  GameSession,
  SavingAmount,
  Student,
} from '../types/game'
import {
  canBet,
  calculateInterest,
  normalizeStudent,
  resetStudentForNextRound,
  settleStudentBet,
} from '../utils/finance'
import { createInitialSession } from '../utils/session'

const MAX_AUDIT_EVENTS = 250
const ROUND_DURATION_MS = 60_000

export type ActionResult = { ok: boolean; message: string }

export type PublicGameState = {
  session: GameSession
  serverNow: number
}

function checksum(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

function calculateSessionDigest(session: GameSession): string {
  const students = Object.values(session.students)
    .sort((a, b) => a.number - b.number)
    .map((student) => ({
      id: student.id,
      number: student.number,
      name: student.name,
      cash: student.cash,
      savings: student.savings,
      debt: student.debt,
      netWorth: student.netWorth,
      currentAnswer: student.currentAnswer,
      currentBet: student.currentBet,
      submitted: student.submitted,
      claimedBy: student.claimedBy,
      claimedAt: student.claimedAt,
      isOccupied: student.isOccupied,
      loanCount: student.loanCount,
      bankrupt: student.bankrupt,
      lastResult: student.lastResult,
    }))

  return checksum(
    JSON.stringify({
      id: session.id,
      status: session.status,
      currentRoundIndex: session.currentRoundIndex,
      roundEndsAt: session.roundEndsAt,
      students,
    }),
  )
}

function finalizeSession(session: GameSession): GameSession {
  const touched = { ...session, updatedAt: Date.now() }
  return { ...touched, stateDigest: calculateSessionDigest(touched) }
}

function createAuditEvent(
  session: GameSession,
  event: Omit<AuditEvent, 'id' | 'at' | 'round'> & { round?: number },
): AuditEvent {
  return {
    ...event,
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    at: Date.now(),
    round: event.round ?? rounds[session.currentRoundIndex]?.round ?? 1,
  }
}

function appendAuditEvents(
  session: GameSession,
  events: AuditEvent[],
): GameSession {
  return {
    ...session,
    auditLog: [...events, ...(session.auditLog ?? [])].slice(0, MAX_AUDIT_EVENTS),
  }
}

function appendAudit(
  session: GameSession,
  event: Omit<AuditEvent, 'id' | 'at' | 'round'> & { round?: number },
): GameSession {
  return appendAuditEvents(session, [createAuditEvent(session, event)])
}

function updateStudent(
  session: GameSession,
  studentId: string,
  updater: (student: Student) => Student,
): GameSession {
  const student = session.students[studentId]
  if (!student) return session

  return {
    ...session,
    students: {
      ...session.students,
      [studentId]: normalizeStudent(updater(student)),
    },
  }
}

function moneySnapshot(student: Student) {
  return {
    cash: student.cash,
    savings: student.savings,
    debt: student.debt,
    netWorth: student.netWorth,
  }
}

function canUseStudentSlot(student: Student, clientId: string): boolean {
  return student.isOccupied && student.claimedBy === clientId
}

function blockedStudentAction(
  session: GameSession,
  student: Student,
  clientId: string,
  action: string,
): { session: GameSession; result: ActionResult } {
  return {
    session: appendAudit(session, {
      actor: 'student',
      actorId: clientId,
      action,
      detail: `Blocked unauthorized action on slot ${student.number} (${student.name}).`,
      severity: 'critical',
      studentId: student.id,
      studentName: student.name,
    }),
    result: {
      ok: false,
      message: 'This slot is not claimed by this device.',
    },
  }
}

function ensureBetAmount(value: number): value is BetAmount {
  return Number.isInteger(value) && value > 0
}

export function createGameEngine(initialSession = createInitialSession()) {
  let session = finalizeSession(initialSession)

  function commit(
    updater: (previous: GameSession) => {
      session: GameSession
      result: ActionResult
    },
  ): ActionResult {
    const next = updater(session)
    session = finalizeSession(next.session)
    return next.result
  }

  function getState(): PublicGameState {
    return {
      session,
      serverNow: Date.now(),
    }
  }

  function resetGame(): ActionResult {
    session = finalizeSession(
      appendAudit(createInitialSession(), {
        actor: 'teacher',
        actorId: 'teacher-dashboard',
        action: 'reset_game',
        detail: 'Teacher reset the classroom game.',
        severity: 'warning',
      }),
    )
    return { ok: true, message: 'Game reset.' }
  }

  function startRound(): ActionResult {
    return commit((previous) => {
      if (previous.status === 'finished') {
        return { session: previous, result: { ok: false, message: 'Game is finished.' } }
      }

      if (previous.status === 'settled') {
        const nextIndex = Math.min(previous.currentRoundIndex + 1, rounds.length - 1)
        if (nextIndex === previous.currentRoundIndex) {
          return {
            session: { ...previous, status: 'finished' },
            result: { ok: true, message: 'Game finished.' },
          }
        }

        const resetStudents = Object.fromEntries(
          Object.entries(previous.students).map(([id, student]) => [
            id,
            resetStudentForNextRound(student),
          ]),
        )

        return {
          session: appendAudit(
            {
              ...previous,
              currentRoundIndex: nextIndex,
              status: 'open',
              roundEndsAt: Date.now() + ROUND_DURATION_MS,
              students: resetStudents,
            },
            {
              actor: 'teacher',
              actorId: 'teacher-dashboard',
              action: 'start_next_round',
              detail: `Teacher started round ${rounds[nextIndex].round}.`,
              severity: 'info',
              round: rounds[nextIndex].round,
            },
          ),
          result: { ok: true, message: 'Next round started.' },
        }
      }

      if (previous.status !== 'waiting') {
        return { session: previous, result: { ok: false, message: 'Round cannot start now.' } }
      }

      return {
        session: appendAudit(
          {
            ...previous,
            status: 'open',
            roundEndsAt: Date.now() + ROUND_DURATION_MS,
            students: Object.fromEntries(
              Object.entries(previous.students).map(([id, student]) => [
                id,
                resetStudentForNextRound(student),
              ]),
            ),
          },
          {
            actor: 'teacher',
            actorId: 'teacher-dashboard',
            action: 'start_round',
            detail: `Teacher started round ${rounds[previous.currentRoundIndex].round}.`,
            severity: 'info',
          },
        ),
        result: { ok: true, message: 'Round started.' },
      }
    })
  }

  function addRoundTime(seconds: number): ActionResult {
    return commit((previous) => {
      if (previous.status !== 'open') {
        return { session: previous, result: { ok: false, message: 'Round is not open.' } }
      }
      const currentEnd = Math.max(previous.roundEndsAt ?? Date.now(), Date.now())
      return {
        session: appendAudit(
          {
            ...previous,
            roundEndsAt: currentEnd + seconds * 1000,
          },
          {
            actor: 'teacher',
            actorId: 'teacher-dashboard',
            action: 'add_round_time',
            detail: `Teacher added ${seconds} seconds to round ${rounds[previous.currentRoundIndex].round}.`,
            severity: 'info',
          },
        ),
        result: { ok: true, message: `Added ${seconds} seconds.` },
      }
    })
  }

  function reopenRound(): ActionResult {
    return commit((previous) => {
      if (previous.status !== 'locked' && previous.status !== 'revealed') {
        return { session: previous, result: { ok: false, message: 'Round cannot reopen now.' } }
      }

      return {
        session: appendAudit(
          {
            ...previous,
            status: 'open',
            roundEndsAt: Date.now() + 30_000,
          },
          {
            actor: 'teacher',
            actorId: 'teacher-dashboard',
            action: 'reopen_round',
            detail: `Teacher reopened round ${rounds[previous.currentRoundIndex].round} for 30 seconds.`,
            severity: 'warning',
          },
        ),
        result: { ok: true, message: 'Round reopened.' },
      }
    })
  }

  function restartCurrentRound(): ActionResult {
    return commit((previous) => {
      if (
        previous.status !== 'open' &&
        previous.status !== 'locked' &&
        previous.status !== 'revealed'
      ) {
        return { session: previous, result: { ok: false, message: 'Round cannot restart now.' } }
      }

      return {
        session: appendAudit(
          {
            ...previous,
            status: 'open',
            roundEndsAt: Date.now() + ROUND_DURATION_MS,
            students: Object.fromEntries(
              Object.entries(previous.students).map(([id, student]) => [
                id,
                resetStudentForNextRound(student),
              ]),
            ),
          },
          {
            actor: 'teacher',
            actorId: 'teacher-dashboard',
            action: 'restart_current_round',
            detail: `Teacher restarted round ${rounds[previous.currentRoundIndex].round}. Existing submissions for this round were cleared.`,
            severity: 'warning',
          },
        ),
        result: { ok: true, message: 'Round restarted.' },
      }
    })
  }

  function lockRound(): ActionResult {
    return commit((previous) => {
      if (previous.status !== 'open') {
        return { session: previous, result: { ok: false, message: 'Round is not open.' } }
      }

      return {
        session: appendAudit(
          { ...previous, status: 'locked', roundEndsAt: null },
          {
            actor: 'teacher',
            actorId: 'teacher-dashboard',
            action: 'lock_round',
            detail: `Teacher locked round ${rounds[previous.currentRoundIndex].round}.`,
            severity: 'info',
          },
        ),
        result: { ok: true, message: 'Round locked.' },
      }
    })
  }

  function revealRound(): ActionResult {
    return commit((previous) => {
      if (previous.status !== 'locked') {
        return { session: previous, result: { ok: false, message: 'Round is not locked.' } }
      }

      return {
        session: appendAudit(
          { ...previous, status: 'revealed', roundEndsAt: null },
          {
            actor: 'teacher',
            actorId: 'teacher-dashboard',
            action: 'reveal_answer',
            detail: `Teacher revealed answer ${rounds[previous.currentRoundIndex].correctAnswer}.`,
            severity: 'info',
          },
        ),
        result: { ok: true, message: 'Answer revealed.' },
      }
    })
  }

  function settleRound(): ActionResult {
    return commit((previous) => {
      if (previous.status !== 'revealed') {
        return { session: previous, result: { ok: false, message: 'Reveal first.' } }
      }
      const round = rounds[previous.currentRoundIndex]
      const paysInterest = round.allowedFeatures.includes('interest')
      const settlementEvents: AuditEvent[] = []

      const students = Object.fromEntries(
        Object.entries(previous.students).map(([id, student]) => {
          const before = moneySnapshot(student)
          const withMissPenalty =
            student.submitted || student.currentBet > 0
              ? student
              : {
                  ...student,
                  cash: 0,
                  lastResult: 'none' as const,
                }
          const settled = settleStudentBet(withMissPenalty, round)
          const withInterest =
            paysInterest && settled.submitted
              ? { ...settled, cash: settled.cash + calculateInterest(settled.savings) }
              : settled
          const normalized = normalizeStudent(withInterest)
          settlementEvents.push(
            createAuditEvent(previous, {
              actor: 'system',
              actorId: 'settlement',
              action: 'settle_student',
              detail: `${student.name}: ${normalized.lastResult ?? 'none'}, cash ${before.cash} -> ${normalized.cash}, net worth ${before.netWorth} -> ${normalized.netWorth}.`,
              severity: student.submitted ? 'info' : 'warning',
              studentId: student.id,
              studentName: student.name,
              before,
              after: moneySnapshot(normalized),
            }),
          )
          return [id, normalized]
        }),
      )

      return {
        session: appendAuditEvents(
          {
            ...previous,
            status: 'settled',
            roundEndsAt: null,
            students,
          },
          settlementEvents,
        ),
        result: { ok: true, message: 'Round settled.' },
      }
    })
  }

  function nextRound(): ActionResult {
    return commit((previous) => {
      if (previous.status !== 'settled') {
        return { session: previous, result: { ok: false, message: 'Settle first.' } }
      }
      if (previous.currentRoundIndex >= rounds.length - 1) {
        return {
          session: appendAudit(
            { ...previous, status: 'finished' },
            {
              actor: 'teacher',
              actorId: 'teacher-dashboard',
              action: 'finish_game',
              detail: 'Teacher finished the game after the final round.',
              severity: 'info',
            },
          ),
          result: { ok: true, message: 'Game finished.' },
        }
      }

      return {
        session: appendAudit(
          {
            ...previous,
            status: 'waiting',
            roundEndsAt: null,
            currentRoundIndex: previous.currentRoundIndex + 1,
            students: Object.fromEntries(
              Object.entries(previous.students).map(([id, student]) => [
                id,
                resetStudentForNextRound(student),
              ]),
            ),
          },
          {
            actor: 'teacher',
            actorId: 'teacher-dashboard',
            action: 'next_round',
            detail: `Teacher moved to round ${rounds[previous.currentRoundIndex + 1].round}.`,
            severity: 'info',
            round: rounds[previous.currentRoundIndex + 1].round,
          },
        ),
        result: { ok: true, message: 'Moved to next round.' },
      }
    })
  }

  function finishGame(): ActionResult {
    return commit((previous) => ({
      session: appendAudit(
        { ...previous, status: 'finished' },
        {
          actor: 'teacher',
          actorId: 'teacher-dashboard',
          action: 'finish_game',
          detail: 'Teacher finished the game.',
          severity: 'info',
        },
      ),
      result: { ok: true, message: 'Game finished.' },
    }))
  }

  function claimSlot(clientId: string, studentId: string, name: string): ActionResult {
    return commit((previous) => {
      const student = previous.students[studentId]
      if (!student) {
        return { session: previous, result: { ok: false, message: 'Student slot not found.' } }
      }
      if (student.isOccupied && student.claimedBy !== clientId) {
        return {
          session: previous,
          result: { ok: false, message: `Slot ${student.number} is already occupied.` },
        }
      }

      const updated = updateStudent(previous, studentId, (current) => ({
        ...current,
        name: name.trim() || current.name,
        claimedBy: clientId,
        claimedAt: current.claimedBy === clientId ? current.claimedAt : Date.now(),
        isOccupied: true,
      }))

      return {
        session: appendAudit(updated, {
          actor: 'student',
          actorId: clientId,
          action: 'claim_slot',
          detail: `${updated.students[studentId].name} claimed slot ${student.number}.`,
          severity: 'info',
          studentId,
          studentName: updated.students[studentId].name,
        }),
        result: { ok: true, message: `Slot ${student.number} claimed.` },
      }
    })
  }

  function releaseSlot(studentId: string): ActionResult {
    return commit((previous) => {
      const student = previous.students[studentId]
      if (!student) {
        return { session: previous, result: { ok: false, message: 'Student slot not found.' } }
      }
      const updated = updateStudent(previous, studentId, (current) => ({
        ...current,
        claimedBy: null,
        claimedAt: null,
        isOccupied: false,
      }))

      return {
        session: appendAudit(updated, {
          actor: 'teacher',
          actorId: 'teacher-dashboard',
          action: 'release_slot',
          detail: `Teacher released slot ${student.number} (${student.name}).`,
          severity: 'warning',
          studentId,
          studentName: student.name,
        }),
        result: { ok: true, message: 'Slot released.' },
      }
    })
  }

  function submitAnswer(
    clientId: string,
    studentId: string,
    answer: AnswerOption,
    bet: number,
  ): ActionResult {
    return commit((previous) => {
      const student = previous.students[studentId]
      if (!student) {
        return { session: previous, result: { ok: false, message: 'Student slot not found.' } }
      }
      if (!canUseStudentSlot(student, clientId)) {
        return blockedStudentAction(previous, student, clientId, 'blocked_submit_answer')
      }
      if (previous.status !== 'open') {
        return { session: previous, result: { ok: false, message: 'This round is not open.' } }
      }
      if ((previous.roundEndsAt ?? 0) <= Date.now()) {
        return {
          session: previous,
          result: { ok: false, message: 'Time is up. Ask your teacher for more time.' },
        }
      }
      if (student.submitted) {
        return { session: previous, result: { ok: false, message: 'Already submitted.' } }
      }
      if (!ensureBetAmount(bet) || !canBet(student, bet)) {
        return {
          session: previous,
          result: { ok: false, message: 'Not enough Classroom Money for that bet.' },
        }
      }

      const updated = updateStudent(previous, studentId, (current) => ({
        ...current,
        currentAnswer: answer,
        currentBet: bet,
        submitted: true,
      }))

      return {
        session: appendAudit(updated, {
          actor: 'student',
          actorId: clientId,
          action: 'submit_answer',
          detail: `${student.name} submitted answer ${answer} with a $${bet} bet.`,
          severity: 'info',
          studentId,
          studentName: student.name,
        }),
        result: { ok: true, message: 'Answer submitted.' },
      }
    })
  }

  function saveMoney(
    clientId: string,
    studentId: string,
    amount: SavingAmount,
  ): ActionResult {
    return commit((previous) => {
      const student = previous.students[studentId]
      const round = rounds[previous.currentRoundIndex]
      if (!student || previous.status !== 'open' || !round.allowedFeatures.includes('saving')) {
        return { session: previous, result: { ok: false, message: 'Saving is not available.' } }
      }
      if (!canUseStudentSlot(student, clientId)) {
        return blockedStudentAction(previous, student, clientId, 'blocked_save_money')
      }
      if ((previous.roundEndsAt ?? 0) <= Date.now()) {
        return {
          session: previous,
          result: { ok: false, message: 'Time is up. Ask your teacher for more time.' },
        }
      }
      if (student.submitted) {
        return {
          session: previous,
          result: { ok: false, message: 'Finance actions close after submitting.' },
        }
      }
      if (student.cash < amount) {
        return {
          session: previous,
          result: { ok: false, message: 'Not enough Classroom Money to save.' },
        }
      }

      const before = moneySnapshot(student)
      const updated = updateStudent(previous, studentId, (current) => ({
        ...current,
        cash: current.cash - amount,
        savings: current.savings + amount,
      }))

      return {
        session: appendAudit(updated, {
          actor: 'student',
          actorId: clientId,
          action: 'save_money',
          detail: `${student.name} saved $${amount}.`,
          severity: 'info',
          studentId,
          studentName: student.name,
          before,
          after: moneySnapshot(updated.students[studentId]),
        }),
        result: { ok: true, message: `Saved $${amount}.` },
      }
    })
  }

  function withdrawSavings(
    clientId: string,
    studentId: string,
    amount: SavingAmount,
  ): ActionResult {
    return commit((previous) => {
      const student = previous.students[studentId]
      const round = rounds[previous.currentRoundIndex]
      if (!student || previous.status !== 'open' || !round.allowedFeatures.includes('saving')) {
        return { session: previous, result: { ok: false, message: 'Withdraw is not available.' } }
      }
      if (!canUseStudentSlot(student, clientId)) {
        return blockedStudentAction(previous, student, clientId, 'blocked_withdraw_savings')
      }
      if ((previous.roundEndsAt ?? 0) <= Date.now()) {
        return {
          session: previous,
          result: { ok: false, message: 'Time is up. Ask your teacher for more time.' },
        }
      }
      if (student.submitted) {
        return {
          session: previous,
          result: { ok: false, message: 'Finance actions close after submitting.' },
        }
      }
      if (student.savings < amount) {
        return {
          session: previous,
          result: { ok: false, message: 'Not enough savings to withdraw.' },
        }
      }

      const before = moneySnapshot(student)
      const updated = updateStudent(previous, studentId, (current) => ({
        ...current,
        cash: current.cash + amount,
        savings: current.savings - amount,
      }))

      return {
        session: appendAudit(updated, {
          actor: 'student',
          actorId: clientId,
          action: 'withdraw_savings',
          detail: `${student.name} withdrew $${amount}.`,
          severity: 'info',
          studentId,
          studentName: student.name,
          before,
          after: moneySnapshot(updated.students[studentId]),
        }),
        result: { ok: true, message: `Withdrew $${amount}.` },
      }
    })
  }

  return {
    getState,
    resetGame,
    startRound,
    addRoundTime,
    reopenRound,
    restartCurrentRound,
    lockRound,
    revealRound,
    settleRound,
    nextRound,
    finishGame,
    claimSlot,
    releaseSlot,
    submitAnswer,
    saveMoney,
    withdrawSavings,
  }
}
