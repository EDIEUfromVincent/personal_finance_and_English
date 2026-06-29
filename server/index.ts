import express from 'express'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'
import { createGameEngine, type ActionResult } from '../src/engine/gameEngine'
import type { AnswerOption, SavingAmount } from '../src/types/game'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
})
const engine = createGameEngine()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const port = Number(process.env.PORT ?? 3000)

function broadcastState() {
  io.emit('game:state', engine.getState())
}

function runAndBroadcast(action: () => ActionResult) {
  const result = action()
  broadcastState()
  return result
}

io.on('connection', (socket) => {
  socket.emit('game:state', engine.getState())

  socket.on('teacher:startRound', (callback) => {
    callback?.(runAndBroadcast(() => engine.startRound()))
  })
  socket.on('teacher:addRoundTime', (seconds: number, callback) => {
    callback?.(runAndBroadcast(() => engine.addRoundTime(seconds)))
  })
  socket.on('teacher:reopenRound', (callback) => {
    callback?.(runAndBroadcast(() => engine.reopenRound()))
  })
  socket.on('teacher:restartCurrentRound', (callback) => {
    callback?.(runAndBroadcast(() => engine.restartCurrentRound()))
  })
  socket.on('teacher:lockRound', (callback) => {
    callback?.(runAndBroadcast(() => engine.lockRound()))
  })
  socket.on('teacher:revealRound', (callback) => {
    callback?.(runAndBroadcast(() => engine.revealRound()))
  })
  socket.on('teacher:settleRound', (callback) => {
    callback?.(runAndBroadcast(() => engine.settleRound()))
  })
  socket.on('teacher:nextRound', (callback) => {
    callback?.(runAndBroadcast(() => engine.nextRound()))
  })
  socket.on('teacher:finishGame', (callback) => {
    callback?.(runAndBroadcast(() => engine.finishGame()))
  })
  socket.on('teacher:resetGame', (callback) => {
    callback?.(runAndBroadcast(() => engine.resetGame()))
  })
  socket.on('teacher:releaseSlot', (studentId: string, callback) => {
    callback?.(runAndBroadcast(() => engine.releaseSlot(studentId)))
  })

  socket.on(
    'student:claimSlot',
    (
      payload: { clientId: string; studentId: string; name: string },
      callback,
    ) => {
      callback?.(
        runAndBroadcast(() =>
          engine.claimSlot(payload.clientId, payload.studentId, payload.name),
        ),
      )
    },
  )
  socket.on(
    'student:submitAnswer',
    (
      payload: {
        clientId: string
        studentId: string
        answer: AnswerOption
        bet: number
      },
      callback,
    ) => {
      callback?.(
        runAndBroadcast(() =>
          engine.submitAnswer(
            payload.clientId,
            payload.studentId,
            payload.answer,
            payload.bet,
          ),
        ),
      )
    },
  )
  socket.on(
    'student:saveMoney',
    (
      payload: { clientId: string; studentId: string; amount: SavingAmount },
      callback,
    ) => {
      callback?.(
        runAndBroadcast(() =>
          engine.saveMoney(payload.clientId, payload.studentId, payload.amount),
        ),
      )
    },
  )
  socket.on(
    'student:withdrawSavings',
    (
      payload: { clientId: string; studentId: string; amount: SavingAmount },
      callback,
    ) => {
      callback?.(
        runAndBroadcast(() =>
          engine.withdrawSavings(
            payload.clientId,
            payload.studentId,
            payload.amount,
          ),
        ),
      )
    },
  )
})

app.use(express.static(distDir))

app.get('/health', (_request, response) => {
  response.json({ ok: true })
})

app.get('*splat', (_request, response) => {
  response.sendFile(path.join(distDir, 'index.html'))
})

httpServer.listen(port, () => {
  console.log(`Classroom game server listening on port ${port}`)
})
