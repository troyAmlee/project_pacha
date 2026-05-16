import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api";

const ClubDataContext = createContext(null);

export function ClubDataProvider({ children }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadBootstrap = useCallback(async () => {
    try {
      setLoading(true);
      const payload = await api.get("/api/bootstrap");
      setData(payload);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  // Prepend a freshly created item and refresh the derived club stats.
  function addItem(collection, item, stats) {
    setData((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [collection]: [item, ...current[collection]],
        stats: stats ?? current.stats
      };
    });
  }

  return (
    <ClubDataContext.Provider value={{ data, loading, error, loadBootstrap, addItem }}>
      {children}
    </ClubDataContext.Provider>
  );
}

export function useClubData() {
  const context = useContext(ClubDataContext);

  if (!context) {
    throw new Error("useClubData must be used within a ClubDataProvider.");
  }

  return context;
}
