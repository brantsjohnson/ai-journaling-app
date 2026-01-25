import { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const ScriptContext = createContext(null);

export const ScriptProvider = ({ children }) => {
  // Load script from localStorage on mount
  const [script, setScriptState] = useState(() => {
    try {
      const stored = localStorage.getItem('journal_script');
      return stored ? stored : null;
    } catch (err) {
      return null;
    }
  });

  // Custom setScript that also saves to localStorage
  const setScript = (value) => {
    setScriptState(value);
    try {
      if (value) {
        localStorage.setItem('journal_script', value);
      } else {
        localStorage.removeItem('journal_script');
      }
    } catch (err) {
      console.error('Error saving script to localStorage:', err);
    }
  };

  return (
    <ScriptContext.Provider value={{ script, setScript }}>
      {children}
    </ScriptContext.Provider>
  );
};

export const useScript = () => {
  return useContext(ScriptContext);
};


ScriptProvider.propTypes = {
  children: PropTypes.node.isRequired, 
};