import { useContext } from 'react'
import { GameContext } from './gameContext'

export function useGame() {
  const value = useContext(GameContext)
  if (!value) {
    throw new Error('useGame must be used inside GameProvider')
  }
  return value
}
