import type { Student } from '../types/game'

type RankingTableProps = {
  students: Student[]
}

export function RankingTable({ students }: RankingTableProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Ranking</p>
          <h2>Net Worth Leaders</h2>
        </div>
      </div>

      <div className="table-wrap compact-table">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Student</th>
              <th>Cash</th>
              <th>Savings</th>
              <th>Debt</th>
              <th>Net Worth</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, index) => (
              <tr className={index < 3 ? 'top-rank' : ''} key={student.id}>
                <td>{index + 1}</td>
                <td>{student.name}</td>
                <td>${student.cash}</td>
                <td>${student.savings}</td>
                <td>${student.debt}</td>
                <td>
                  <strong>${student.netWorth}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
