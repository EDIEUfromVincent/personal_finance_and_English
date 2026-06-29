import { useEffect, useMemo, useState } from 'react'
import { SESSION_ID } from '../data/constants'
import { useGame } from '../state/useGame'

export function StudentJoinPage() {
  const { claimSlot, clientId, students } = useGame()
  const [studentId, setStudentId] = useState(students[0]?.id ?? '')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === studentId),
    [studentId, students],
  )
  const firstAvailableStudent = useMemo(
    () =>
      students.find(
        (student) => !student.isOccupied || student.claimedBy === clientId,
      ),
    [clientId, students],
  )
  const selectedByOther =
    Boolean(selectedStudent?.isOccupied) && selectedStudent?.claimedBy !== clientId

  useEffect(() => {
    if (selectedStudent && !selectedByOther) return
    if (firstAvailableStudent) {
      setStudentId(firstAvailableStudent.id)
    }
  }, [firstAvailableStudent, selectedByOther, selectedStudent])

  const join = async () => {
    if (!selectedStudent) return
    const result = await claimSlot(selectedStudent.id, name || selectedStudent.name)
    if (!result.ok) {
      setMessage(result.message)
      return
    }
    window.location.href = `/student/${SESSION_ID}/${selectedStudent.id}`
  }

  return (
    <main className="page narrow-page">
      <section className="panel join-panel">
        <p className="eyebrow">Student Join</p>
        <h1>Choose Your Student Slot</h1>
        <p className="muted">
          Session {SESSION_ID}. Your teacher controls round start, lock, reveal,
          and settlement.
        </p>

        <label>
          Student Slot
          <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
            {students.map((student) => (
              <option
                disabled={student.isOccupied && student.claimedBy !== clientId}
                key={student.id}
                value={student.id}
              >
                {student.number}. {student.name}
                {student.isOccupied && student.claimedBy === clientId
                  ? ' (yours)'
                  : student.isOccupied
                    ? ' (occupied)'
                    : ''}
              </option>
            ))}
          </select>
        </label>

        <label>
          Display Name
          <input
            maxLength={24}
            onChange={(event) => setName(event.target.value)}
            placeholder={selectedStudent?.name}
            value={name}
          />
        </label>

        <button
          className="primary-button full-width"
          disabled={!selectedStudent || selectedByOther}
          onClick={join}
          type="button"
        >
          Enter Game
        </button>
        {message ? <p className="message">{message}</p> : null}
      </section>
    </main>
  )
}
