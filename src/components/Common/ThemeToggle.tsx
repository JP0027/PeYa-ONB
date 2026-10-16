import React from 'react';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showText?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', showText = true }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`px-3 py-2 rounded-xl border flex items-center justify-center gap-2 transition cursor-pointer shadow-sm hover:scale-102 active:scale-95 text-xs font-bold select-none ${
        isDark 
          ? 'bg-[#27272a] hover:bg-[#323238] text-amber-300 border-[#3f3f46]' 
          : 'bg-white hover:bg-slate-100 text-amber-600 border-slate-300'
      } ${className}`}
      title={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
    >
      <span className="text-base leading-none">{isDark ? '🌙' : '☀️'}</span>
      {showText && <span className="leading-none">{isDark ? 'Modo Oscuro' : 'Modo Claro'}</span>}
    </button>
  );
};

export default ThemeToggle;
