import { useSyncExternalStore } from 'react';
import { getConnectionSnapshot, subscribeToConnection } from '../services/connection';

export default function useConnectionStatus() {
  return useSyncExternalStore(
    subscribeToConnection,
    getConnectionSnapshot,
    getConnectionSnapshot,
  );
}
