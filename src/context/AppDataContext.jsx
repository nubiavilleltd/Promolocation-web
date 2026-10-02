import React from "react";
import { createContext, useContext, useEffect } from "react";
import { defaultPromoters } from "../data/seed";
import { useLocalStorageState } from "../hooks/useLocalStorageState";

const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
  const [promoters, setPromoters] = useLocalStorageState(
    "promolocationPromoters",
    defaultPromoters,
  );
  useEffect(() => {
    window.localStorage.removeItem("promolocationIncidents");
  }, []);

  const addPromoter = (promoter) => {
    setPromoters((currentPromoters) => [...currentPromoters, promoter]);
  };

  const updatePromoterStatus = (userId, status) => {
    setPromoters((currentPromoters) =>
      currentPromoters.map((promoter) =>
        promoter.userId === userId ? { ...promoter, status } : promoter,
      ),
    );
  };

  return (
    <AppDataContext.Provider
      value={{
        promoters,
        addPromoter,
        updatePromoterStatus,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);

  if (!context) {
    throw new Error("useAppData must be used inside AppDataProvider.");
  }

  return context;
}
