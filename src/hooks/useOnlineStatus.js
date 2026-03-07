/**
 * useOnlineStatus.js
 * 
 * React hook that tracks the device's network connection.
 * Use this to show an offline banner inside your app pages.
 * 
 * Usage:
 *   import { useOnlineStatus } from '@/hooks/useOnlineStatus';
 * 
 *   function MyPage() {
 *     const isOnline = useOnlineStatus();
 *     return (
 *       <>
 *         {!isOnline && <OfflineBanner />}
 *         ...rest of page
 *       </>
 *     );
 *   }
 */

import { useState, useEffect } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}
