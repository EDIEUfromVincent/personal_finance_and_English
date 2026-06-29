import { SESSION_ID, STARTING_CASH, STUDENT_COUNT } from '../data/constants'
import type { GameSession, Student } from '../types/game'

export function createStudent(number: number): Student {
  return {
    id: `student-${number}`,
    number,
    name: `Student ${number}`,
    cash: STARTING_CASH,
    savings: 0,
    debt: 0,
    netWorth: STARTING_CASH,
    currentAnswer: null,
    currentBet: 0,
    submitted: false,
    claimedBy: null,
    claimedAt: null,
    isOccupied: false,
    loanCount: 0,
    bankrupt: false,
    insurance: null,
    lastResult: undefined,
  }
}

export function createStudents(): Record<string, Student> {
  return Array.from({ length: STUDENT_COUNT }, (_, index) =>
    createStudent(index + 1),
  ).reduce<Record<string, Student>>((students, student) => {
    students[student.id] = student
    return students
  }, {})
}

export function createInitialSession(): GameSession {
  const now = Date.now()
  return {
    id: SESSION_ID,
    title: 'Classroom English Finance Game',
    status: 'waiting',
    currentRoundIndex: 0,
    roundEndsAt: null,
    students: createStudents(),
    auditLog: [],
    stateDigest: '',
    createdAt: now,
    updatedAt: now,
  }
}
