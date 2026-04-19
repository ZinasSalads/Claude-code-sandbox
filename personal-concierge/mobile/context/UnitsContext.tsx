import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getUnitSystem, setUnitSystem, UnitSystem } from '../lib/units';

interface UnitsContextType {
  units: UnitSystem;
  setUnits: (system: UnitSystem) => Promise<void>;
}

const UnitsContext = createContext<UnitsContextType>({ units: 'imperial', setUnits: async () => {} });

export function UnitsProvider({ children }: { children: React.ReactNode }) {
  const [units, setUnitsState] = useState<UnitSystem>('imperial');

  useEffect(() => {
    getUnitSystem().then(setUnitsState);
  }, []);

  const setUnits = useCallback(async (system: UnitSystem) => {
    await setUnitSystem(system);
    setUnitsState(system);
  }, []);

  return <UnitsContext.Provider value={{ units, setUnits }}>{children}</UnitsContext.Provider>;
}

export function useUnits(): UnitsContextType {
  return useContext(UnitsContext);
}
