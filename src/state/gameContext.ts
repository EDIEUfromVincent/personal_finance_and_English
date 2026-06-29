import { createContext } from 'react'
import { rounds } from '../data/rounds'
import type {
  AnswerOption,
  GameSession,
  SavingAmount,
  Student,
} from '../types/game'
import type { ActionResult } from '../engine/gameEngine'

export type GameContextValue = {
  clientId: string
  session: GameSession
  currentRound: (typeof rounds)[number]
  timeRemainingSeconds: number
  students: Student[]
  ranking: Student[]
  submittedCount: number
  connected: boolean
  resetGame: () => Promise<ActionResult>
  startRound: () => Promise<ActionResult>
  addRoundTime: (seconds: number) => Promise<ActionResult>
  reopenRound: () => Promise<ActionResult>
  restartCurrentRound: () => Promise<ActionResult>
  lockRound: () => Promise<ActionResult>
  revealRound: () => Promise<ActionResult>
  settleRound: () => Promise<ActionResult>
  nextRound: () => Promise<ActionResult>
  finishGame: () => Promise<ActionResult>
  claimSlot: (
    studentId: string,
    name: string,
  ) => Promise<ActionResult>
  releaseSlot: (studentId: string) => Promise<ActionResult>
  renameStudent: (studentId: string, name: string) => void
  submitAnswer: (
    studentId: string,
    answer: AnswerOption,
    bet: number,
  ) => Promise<ActionResult>
  saveMoney: (
    studentId: string,
    amount: SavingAmount,
  ) => Promise<ActionResult>
  withdrawSavings: (
    studentId: string,
    amount: SavingAmount,
  ) => Promise<ActionResult>
}

export const GameContext = createContext<GameContextValue | null>(null)
