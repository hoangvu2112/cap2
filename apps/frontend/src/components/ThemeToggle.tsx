import React, { useContext } from 'react';
import { ThemeContext } from '@/components/theme-provider';

const ThemeToggle = () => {
    const { theme, toggleTheme } = useContext(ThemeContext);

    return (
        <button
            onClick={toggleTheme}
            className="p-2 px-4 rounded bg-gray-200 dark:bg-gray-700 text-black dark:text-white transition"
        >
            Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
        </button>
    );
};

export default ThemeToggle;
