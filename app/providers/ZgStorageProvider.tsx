import { createContext, useState, useEffect, useContext, ReactNode } from "react";
import { ZgStorageService, getZgStorageService } from "../../lib/zg-storage";
import { useAccount } from "wagmi";

export const ZgStorageContext = createContext<{
  zgStorage: ZgStorageService | null;
  isConnected: boolean;
  error?: string;
  isWalletConnected: boolean;
}>({ 
  zgStorage: null, 
  isConnected: false,
  isWalletConnected: false
});

export const ZgStorageProvider = ({ children }: { children: ReactNode }) => {
  const [zgStorage, setZgStorage] = useState<ZgStorageService | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const { isConnected: isWalletConnected } = useAccount();

  const initializeZgStorage = async () => {
    try {
      setError(undefined);
      
      const zgStorageService = getZgStorageService({
        rpcUrl: 'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f',
        indexerRpc: 'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f',
      });

      setZgStorage(zgStorageService);

      const networkStatus = await zgStorageService.getNetworkStatus();
      if (networkStatus.rpc && networkStatus.indexer) {
        setIsConnected(true);
      } else {
        setIsConnected(false);
        setError('Failed to connect to storage network');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
      setIsConnected(false);
    }
  };
  
  useEffect(() => {
    initializeZgStorage();
  }, []);

  return (
    <ZgStorageContext.Provider value={{ zgStorage, isConnected, error, isWalletConnected }}>
      {children}
    </ZgStorageContext.Provider>
  );
};

export const useZgStorage = () => {
  const { zgStorage, isConnected, error, isWalletConnected } = useContext(ZgStorageContext);
  return { zgStorage, isConnected, error, isWalletConnected };
};
