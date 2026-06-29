import type { BetAmount, Round, Student } from '../types/game'

export function calculateNetWorth(student: Student): number {
  return student.cash + student.savings - student.debt
}

export function canBet(student: Student, bet: number): boolean {
  if (student.bankrupt && bet > 20) return false
  const availableRiskCapital = Math.max(student.cash, student.cash + student.debt)
  return Number.isInteger(bet) && bet > 0 && availableRiskCapital >= bet
}

export function calculateInterest(savings: number): number {
  return Math.floor(savings * 0.1)
}

export function getBankLoanPayback(amount: BetAmount): number {
  const table: Record<BetAmount, number> = { 10: 12, 20: 24, 30: 36, 50: 60 }
  return table[amount]
}

export function normalizeStudent(student: Student): Student {
  const netWorth = calculateNetWorth(student)
  return {
    ...student,
    netWorth,
    bankrupt: netWorth <= 0,
  }
}

export function settleStudentBet(student: Student, round: Round): Student {
  if (!student.submitted || student.currentAnswer === null) {
    return normalizeStudent({ ...student, lastResult: 'none', insurance: null })
  }

  const isCorrect = student.currentAnswer === round.correctAnswer
  let cash = student.cash

  if (isCorrect) {
    cash += student.currentBet
  } else {
    const protection =
      student.insurance?.round === round.round ? student.insurance.protection : 0
    const loss = Math.max(0, student.currentBet - protection)
    cash -= loss
  }

  return normalizeStudent({
    ...student,
    cash,
    lastResult: isCorrect ? 'correct' : 'wrong',
    insurance: null,
  })
}

export function resetStudentForNextRound(student: Student): Student {
  return {
    ...student,
    currentAnswer: null,
    currentBet: 0,
    submitted: false,
    insurance: null,
  }
}
