import { useTheme } from '../../context/ThemeContext.jsx'
import { Sun, Moon } from 'lucide-react'
import Button from '../common/Button'

export default function DarkModeToggle() {
  const { darkMode, toggleDarkMode } = useTheme()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleDarkMode}
      aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={darkMode}
      className="p-2"
    >
      {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  )
}