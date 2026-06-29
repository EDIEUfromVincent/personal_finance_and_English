import { useEffect, useState } from 'react'
import './App.css'
import { SocketGameProvider } from './state/SocketGameProvider'
import { LandingPage } from './pages/LandingPage'
import { StudentJoinPage } from './pages/StudentJoinPage'
import { StudentPage } from './pages/StudentPage'
import { TeacherPage } from './pages/TeacherPage'

function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname)

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return pathname
}

function Router() {
  const pathname = usePathname()
  const [, section, sessionId, studentId] = pathname.split('/')

  if (section === 'teacher') return <TeacherPage />
  if (section === 'student' && sessionId && studentId) {
    return <StudentPage studentId={studentId} />
  }
  if (section === 'student') return <StudentJoinPage />
  return <LandingPage />
}

function App() {
  return (
    <SocketGameProvider>
      <Router />
    </SocketGameProvider>
  )
}

export default App
