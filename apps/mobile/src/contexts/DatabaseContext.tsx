import React, { createContext, useContext, useEffect, useState } from 'react';
import type { IDatabase } from '@envoy/database-core';
import { MobileDatabaseService } from '../services/MobileDatabaseService';

interface DatabaseContextValue {
  db: IDatabase | null;
  isReady: boolean;
}

const DatabaseContext = createContext<DatabaseContextValue>({
  db: null,
  isReady: false,
});

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<IDatabase | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const database = new MobileDatabaseService();
    database.initialize().then(() => {
      setDb(database);
      setIsReady(true);
    }).catch((error) => {
      console.error('Failed to initialize database:', error);
    });
  }, []);

  return (
    <DatabaseContext.Provider value={{ db, isReady }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase(): IDatabase | null {
  const { db } = useContext(DatabaseContext);
  return db;
}

export function useDatabaseReady(): boolean {
  const { isReady } = useContext(DatabaseContext);
  return isReady;
}
