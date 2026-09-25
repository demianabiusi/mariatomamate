import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'dracula' | 'tokyo-night' | 'solarized' | 'nord';

export interface ThemeOption {
  id: Theme;
  nameKey: string;
  icon: string;
  /** Color de acento principal para el preview del selector */
  accentColor: string;
  /** Color de fondo para el preview del selector */
  bgColor: string;
  /** Tema de Monaco Editor a usar */
  monacoTheme: string;
}

export const AVAILABLE_THEMES: ThemeOption[] = [
  {
    id: 'dark',
    nameKey: 'theme.dark',
    icon: '🌙',
    accentColor: '#34d399',
    bgColor: '#18181b',
    monacoTheme: 'vs-dark',
  },
  {
    id: 'light',
    nameKey: 'theme.light',
    icon: '☀️',
    accentColor: '#059669',
    bgColor: '#f8fafc',
    monacoTheme: 'vs',
  },
  {
    id: 'dracula',
    nameKey: 'theme.dracula',
    icon: '🧛',
    accentColor: '#50fa7b',
    bgColor: '#282a36',
    monacoTheme: 'dracula-monaco',
  },
  {
    id: 'tokyo-night',
    nameKey: 'theme.tokyoNight',
    icon: '🌆',
    accentColor: '#9ece6a',
    bgColor: '#1a1b2e',
    monacoTheme: 'tokyo-night-monaco',
  },
  {
    id: 'solarized',
    nameKey: 'theme.solarized',
    icon: '🌅',
    accentColor: '#2aa198',
    bgColor: '#002b36',
    monacoTheme: 'solarized-monaco',
  },
  {
    id: 'nord',
    nameKey: 'theme.nord',
    icon: '🧊',
    accentColor: '#88c0d0',
    bgColor: '#2e3440',
    monacoTheme: 'nord-monaco',
  },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  availableThemes: ThemeOption[];
  currentThemeOption: ThemeOption;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'mariatomamate_theme';

/** Registers custom Monaco editor themes so they are ready before the editor mounts. */
function registerMonacoThemes(monaco: any) {
  // Dracula
  monaco.editor.defineTheme('dracula-monaco', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'ff79c6', fontStyle: 'bold' },
      { token: 'keyword.sql', foreground: 'ff79c6', fontStyle: 'bold' },
      { token: 'string', foreground: 'f1fa8c' },
      { token: 'string.sql', foreground: 'f1fa8c' },
      { token: 'number', foreground: 'bd93f9' },
      { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
      { token: 'identifier', foreground: 'f8f8f2' },
      { token: 'operator', foreground: 'ff79c6' },
      { token: 'predefined', foreground: '8be9fd' },
    ],
    colors: {
      'editor.background': '#282a36',
      'editor.foreground': '#f8f8f2',
      'editor.lineHighlightBackground': '#44475a',
      'editorLineNumber.foreground': '#6272a4',
      'editorCursor.foreground': '#f8f8f2',
      'editor.selectionBackground': '#44475a',
      'editor.inactiveSelectionBackground': '#3a3c4e',
      'editorIndentGuide.background1': '#44475a',
      'editorWhitespace.foreground': '#44475a',
      'scrollbarSlider.background': '#44475a80',
      'scrollbarSlider.hoverBackground': '#6272a4',
    },
  });

  // Tokyo Night
  monaco.editor.defineTheme('tokyo-night-monaco', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'bb9af7', fontStyle: 'bold' },
      { token: 'keyword.sql', foreground: 'bb9af7', fontStyle: 'bold' },
      { token: 'string', foreground: '9ece6a' },
      { token: 'string.sql', foreground: '9ece6a' },
      { token: 'number', foreground: 'ff9e64' },
      { token: 'comment', foreground: '444676', fontStyle: 'italic' },
      { token: 'identifier', foreground: 'c0caf5' },
      { token: 'operator', foreground: '89ddff' },
      { token: 'predefined', foreground: '7dcfff' },
    ],
    colors: {
      'editor.background': '#1a1b2e',
      'editor.foreground': '#c0caf5',
      'editor.lineHighlightBackground': '#24253a',
      'editorLineNumber.foreground': '#3b3d5c',
      'editorCursor.foreground': '#c0caf5',
      'editor.selectionBackground': '#2f3048',
      'editor.inactiveSelectionBackground': '#2a2b42',
      'editorIndentGuide.background1': '#2f3048',
      'editorWhitespace.foreground': '#2f3048',
      'scrollbarSlider.background': '#2f304880',
      'scrollbarSlider.hoverBackground': '#444674',
    },
  });

  // Solarized Dark
  monaco.editor.defineTheme('solarized-monaco', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '859900', fontStyle: 'bold' },
      { token: 'keyword.sql', foreground: '859900', fontStyle: 'bold' },
      { token: 'string', foreground: '2aa198' },
      { token: 'string.sql', foreground: '2aa198' },
      { token: 'number', foreground: 'd33682' },
      { token: 'comment', foreground: '586e75', fontStyle: 'italic' },
      { token: 'identifier', foreground: '839496' },
      { token: 'operator', foreground: '93a1a1' },
      { token: 'predefined', foreground: '268bd2' },
    ],
    colors: {
      'editor.background': '#002b36',
      'editor.foreground': '#839496',
      'editor.lineHighlightBackground': '#073642',
      'editorLineNumber.foreground': '#586e75',
      'editorCursor.foreground': '#839496',
      'editor.selectionBackground': '#073642',
      'editor.inactiveSelectionBackground': '#05303a',
      'editorIndentGuide.background1': '#073642',
      'editorWhitespace.foreground': '#094956',
      'scrollbarSlider.background': '#07364280',
      'scrollbarSlider.hoverBackground': '#094956',
    },
  });

  // Nord
  monaco.editor.defineTheme('nord-monaco', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '81a1c1', fontStyle: 'bold' },
      { token: 'keyword.sql', foreground: '81a1c1', fontStyle: 'bold' },
      { token: 'string', foreground: 'a3be8c' },
      { token: 'string.sql', foreground: 'a3be8c' },
      { token: 'number', foreground: 'b48ead' },
      { token: 'comment', foreground: '4c566a', fontStyle: 'italic' },
      { token: 'identifier', foreground: 'd8dee9' },
      { token: 'operator', foreground: '88c0d0' },
      { token: 'predefined', foreground: '8fbcbb' },
    ],
    colors: {
      'editor.background': '#2e3440',
      'editor.foreground': '#d8dee9',
      'editor.lineHighlightBackground': '#3b4252',
      'editorLineNumber.foreground': '#4c566a',
      'editorCursor.foreground': '#d8dee9',
      'editor.selectionBackground': '#434c5e',
      'editor.inactiveSelectionBackground': '#3d4555',
      'editorIndentGuide.background1': '#434c5e',
      'editorWhitespace.foreground': '#434c5e',
      'scrollbarSlider.background': '#434c5e80',
      'scrollbarSlider.hoverBackground': '#4c566a',
    },
  });
}

// Expose so SqlEditor can call it once Monaco is loaded
export { registerMonacoThemes };

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved && AVAILABLE_THEMES.find(t => t.id === saved)) return saved;
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  };

  const currentThemeOption = AVAILABLE_THEMES.find(t => t.id === theme) ?? AVAILABLE_THEMES[0];

  return (
    <ThemeContext.Provider value={{ theme, setTheme, availableThemes: AVAILABLE_THEMES, currentThemeOption }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
