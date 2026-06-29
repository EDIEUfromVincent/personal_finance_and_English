export type Feature =
  | 'betting'
  | 'saving'
  | 'interest'
  | 'bankLoan'
  | 'peerLoan'
  | 'investment'
  | 'insurance'

export type GameStatus =
  | 'waiting'
  | 'open'
  | 'locked'
  | 'revealed'
  | 'settled'
  | 'finished'

export type AnswerOption = 1 | 2 | 3 | 4 | 5
export type BetAmount = 10 | 20 | 30 | 50
export type SavingAmount = 10 | 20 | 30 | 50
export type LastResult = 'correct' | 'wrong' | 'none'
export type AuditSeverity = 'info' | 'warning' | 'critical'
export type AuditActor = 'teacher' | 'student' | 'system'

export type Insurance = {
  cost: 5 | 10
  protection: 10 | 20
  round: number
}

export type Student = {
  id: string
  number: number
  name: string
  cash: number
  savings: number
  debt: number
  netWorth: number
  currentAnswer: AnswerOption | null
  currentBet: number
  submitted: boolean
  claimedBy: string | null
  claimedAt: number | null
  isOccupied: boolean
  loanCount: number
  bankrupt: boolean
  insurance: Insurance | null
  lastResult?: LastResult
}

export type Round = {
  round: number
  type: 'what_about_blank' | 'be_going_to_blank' | 'reaction_blank'
  question: string
  choices: string[]
  correctAnswer: AnswerOption
  allowedFeatures: Feature[]
}

export type AuditEvent = {
  id: string
  at: number
  actor: AuditActor
  actorId: string
  action: string
  detail: string
  round: number
  severity: AuditSeverity
  studentId?: string
  studentName?: string
  before?: {
    cash: number
    savings: number
    debt: number
    netWorth: number
  }
  after?: {
    cash: number
    savings: number
    debt: number
    netWorth: number
  }
}

export type GameSession = {
  id: string
  title: string
  status: GameStatus
  currentRoundIndex: number
  roundEndsAt: number | null
  students: Record<string, Student>
  auditLog: AuditEvent[]
  stateDigest: string
  createdAt: number
  updatedAt: number
}
