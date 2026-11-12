/* ========================================
   THEMECONTEXT.JSX - THEME MANAGEMENT
   Quản lý dark/light mode cho toàn app
   - Toggle giữa dark và light theme
   - Lưu preference vào localStorage
   - Auto apply theme khi reload
======================================== */

import { createContext, useContext, useLayoutEffect, useState } from 'react';

const FONT_SCALE_STORAGE_KEY = 'atrium-font-scale';
const FONT_SCALE_REM = {
  normal: '100%',
  comfortable: '112.5%',
  large: '125%',
};

const ThemeContext = createContext();

function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}

export { useTheme };

function ThemeProvider({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');

    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return false;
  });

  const [fontScale, setFontScaleState] = useState(() => {
    const s = localStorage.getItem(FONT_SCALE_STORAGE_KEY);
    if (s === 'comfortable' || s === 'large' || s === 'normal') return s;
    return 'normal';
  });

  useLayoutEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.remove('light');
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  }, [isDarkMode]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = FONT_SCALE_REM[fontScale] || '100%';
    localStorage.setItem(FONT_SCALE_STORAGE_KEY, fontScale);
  }, [fontScale]);

  const setFontScale = (value) => {
    if (FONT_SCALE_REM[value] != null) setFontScaleState(value);
  };

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, fontScale, setFontScale }}>
      {children}
    </ThemeContext.Provider>
  );
}

export { ThemeProvider };
