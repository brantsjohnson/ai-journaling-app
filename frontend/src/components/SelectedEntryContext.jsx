import { createContext, useContext, useState } from 'react';
import PropTypes from 'prop-types';

const SelectedEntryContext = createContext(null);

export const SelectedEntryProvider = ({ children }) => {
  const [selectedEntry, setSelectedEntry] = useState(null);

  return (
    <SelectedEntryContext.Provider value={{ selectedEntry, setSelectedEntry }}>
      {children}
    </SelectedEntryContext.Provider>
  );
};

export const useSelectedEntry = () => {
  return useContext(SelectedEntryContext);
};

SelectedEntryProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

