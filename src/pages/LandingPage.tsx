import { SESSION_ID } from '../data/constants'

export function LandingPage() {
  return (
    <main className="page landing-page">
      <section className="hero-band">
        <div className="hero-copy">
          <p className="eyebrow">Phase 1 Classroom Harness</p>
          <h1>Classroom English Finance Game</h1>
          <p>
            This is not real money. It is a classroom learning game for English
            practice, risk management, saving, and net worth awareness.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="/teacher">
              Teacher Dashboard
            </a>
            <a className="secondary-button" href="/student">
              Student Join
            </a>
          </div>
        </div>
        <div className="session-card">
          <span>Session Code</span>
          <strong>{SESSION_ID}</strong>
          <p>26 numbered student slots are ready.</p>
        </div>
      </section>
    </main>
  )
}
