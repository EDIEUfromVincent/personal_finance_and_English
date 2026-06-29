import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { io, type Socket } from 'socket.io-client'
import { rounds } from '../data/rounds'
import type { PublicGameState, ActionResult } from '../engine/gameEngine'
import type {
  AnswerOption,
  GameSession,
  LoanAmount,
  SavingAmount,
} from '../types/game'
import { createInitialSession } from '../utils/session'
import { GameContext, type GameContextValue } from './gameContext'

const CLIENT_ID_KEY = 'classroom-finance-phase-1-client-id'
const DEFAULT_ACTION_RESULT: ActionResult = {
  ok: false,
  message: 'Server did not respond.',
}

function createClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `client-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function loadClientId(): string {
  const existing = sessionStorage.getItem(CLIENT_ID_KEY)
  if (existing) return existing

  const next = createClientId()
  sessionStorage.setItem(CLIENT_ID_KEY, next)
  return next
}

function createSocket(): Socket {
  return io({
    transports: ['websocket', 'polling'],
  })
}

function askServer<TPayload>(
  socket: Socket | null,
  eventName: string,
  payload?: TPayload,
): Promise<ActionResult> {
  if (!socket?.connected) {
    return Promise.resolve({
      ok: false,
      message: 'Server is disconnected. Refresh or wait a moment.',
    })
  }

  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => resolve(DEFAULT_ACTION_RESULT), 5000)
    const callback = (result: ActionResult) => {
      window.clearTimeout(timeoutId)
      resolve(result ?? DEFAULT_ACTION_RESULT)
    }

    if (payload === undefined) {
      socket.emit(eventName, callback)
    } else {
      socket.emit(eventName, payload, callback)
    }
  })
}

export function SocketGameProvider({ children }: { children: ReactNode }) {
  const [clientId] = useState(loadClientId)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [serverNow, setServerNow] = useState(Date.now)
  const [now, setNow] = useState(Date.now)
  const [session, setSession] = useState<GameSession>(createInitialSession)
  const currentRound = rounds[session.currentRoundIndex] ?? rounds[0]

  useEffect(() => {
    const nextSocket = createSocket()
    setSocket(nextSocket)

    nextSocket.on('connect', () => setConnected(true))
    nextSocket.on('disconnect', () => setConnected(false))
    nextSocket.on('game:state', (state: PublicGameState) => {
      setSession(state.session)
      setServerNow(state.serverNow)
      setNow(Date.now())
    })

    return () => {
      nextSocket.disconnect()
    }
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  const students = useMemo(
    () => Object.values(session.students).sort((a, b) => a.number - b.number),
    [session.students],
  )

  const ranking = useMemo(
    () =>
      [...students].sort(
        (a, b) =>
          b.netWorth - a.netWorth ||
          b.savings - a.savings ||
          b.cash - a.cash ||
          a.number - b.number,
      ),
    [students],
  )

  const submittedCount = useMemo(
    () => students.filter((student) => student.submitted).length,
    [students],
  )
  const serverNowEstimate = serverNow + (now - serverNow)
  const timeRemainingSeconds = Math.max(
    0,
    Math.ceil(((session.roundEndsAt ?? serverNowEstimate) - serverNowEstimate) / 1000),
  )

  const resetGame = useCallback(
    () => askServer(socket, 'teacher:resetGame'),
    [socket],
  )
  const startRound = useCallback(
    () => askServer(socket, 'teacher:startRound'),
    [socket],
  )
  const addRoundTime = useCallback(
    (seconds: number) => askServer(socket, 'teacher:addRoundTime', seconds),
    [socket],
  )
  const reopenRound = useCallback(
    () => askServer(socket, 'teacher:reopenRound'),
    [socket],
  )
  const restartCurrentRound = useCallback(
    () => askServer(socket, 'teacher:restartCurrentRound'),
    [socket],
  )
  const lockRound = useCallback(
    () => askServer(socket, 'teacher:lockRound'),
    [socket],
  )
  const revealRound = useCallback(
    () => askServer(socket, 'teacher:revealRound'),
    [socket],
  )
  const settleRound = useCallback(
    () => askServer(socket, 'teacher:settleRound'),
    [socket],
  )
  const nextRound = useCallback(
    () => askServer(socket, 'teacher:nextRound'),
    [socket],
  )
  const finishGame = useCallback(
    () => askServer(socket, 'teacher:finishGame'),
    [socket],
  )
  const claimSlot = useCallback(
    (studentId: string, name: string) =>
      askServer(socket, 'student:claimSlot', { clientId, studentId, name }),
    [clientId, socket],
  )
  const releaseSlot = useCallback(
    (studentId: string) => askServer(socket, 'teacher:releaseSlot', studentId),
    [socket],
  )
  const renameStudent = useCallback((_studentId: string, _name: string) => {
    // Names are now set through claimSlot so students cannot freely rename slots.
  }, [])
  const submitAnswer = useCallback(
    (studentId: string, answer: AnswerOption, bet: number) =>
      askServer(socket, 'student:submitAnswer', {
        clientId,
        studentId,
        answer,
        bet,
      }),
    [clientId, socket],
  )
  const saveMoney = useCallback(
    (studentId: string, amount: SavingAmount) =>
      askServer(socket, 'student:saveMoney', { clientId, studentId, amount }),
    [clientId, socket],
  )
  const withdrawSavings = useCallback(
    (studentId: string, amount: SavingAmount) =>
      askServer(socket, 'student:withdrawSavings', {
        clientId,
        studentId,
        amount,
      }),
    [clientId, socket],
  )
  const requestBankLoan = useCallback(
    (studentId: string, amount: LoanAmount) =>
      askServer(socket, 'student:requestBankLoan', {
        clientId,
        studentId,
        amount,
      }),
    [clientId, socket],
  )
  const resolveBankLoan = useCallback(
    (requestId: string, approved: boolean) =>
      askServer(socket, 'teacher:resolveBankLoan', { requestId, approved }),
    [socket],
  )
  const requestPeerLoan = useCallback(
    (borrowerId: string, lenderId: string, amount: LoanAmount) =>
      askServer(socket, 'student:requestPeerLoan', {
        clientId,
        borrowerId,
        lenderId,
        amount,
      }),
    [clientId, socket],
  )
  const resolvePeerLoan = useCallback(
    (requestId: string, approved: boolean) =>
      askServer(socket, 'teacher:resolvePeerLoan', { requestId, approved }),
    [socket],
  )

  const value: GameContextValue = {
    clientId,
    connected,
    session,
    currentRound,
    timeRemainingSeconds,
    students,
    ranking,
    submittedCount,
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
    renameStudent,
    submitAnswer,
    saveMoney,
    withdrawSavings,
    requestBankLoan,
    resolveBankLoan,
    requestPeerLoan,
    resolvePeerLoan,
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}
