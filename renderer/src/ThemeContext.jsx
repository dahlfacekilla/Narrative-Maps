/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react'
import { DARK_THEME, LIGHT_THEME } from './theme.js'

export const ThemeContext = createContext({ theme: DARK_THEME, isDark: true, toggleTheme: () => {} })

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('ns-theme') !== 'light')

  const theme = isDark ? DARK_THEME : LIGHT_THEME

  useEffect(() => {
    localStorage.setItem('ns-theme', isDark ? 'dark' : 'light')
    document.body.style.background = theme.bgApp
  }, [isDark, theme.bgApp])

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme: () => setIsDark(d => !d) }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
