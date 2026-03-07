/**
 * OfflineBanner.jsx
 * 
 * Drop this inside any layout/dashboard wrapper to show a WhatsApp-style
 * "no internet" bar when the device goes offline.
 * 
 * Usage in a dashboard layout:
 *   import OfflineBanner from '@/components/OfflineBanner';
 *   import { useOnlineStatus } from '@/hooks/useOnlineStatus';
 * 
 *   export default function DashboardLayout({ children }) {
 *     const isOnline = useOnlineStatus();
 *     return (
 *       <div>
 *         <OfflineBanner />
 *         {children}
 *       </div>
 *     );
 *   }
 */

import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { WifiOff, Wifi } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    }
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      const t = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3000); // hide "reconnected" after 3s
      return () => clearTimeout(t);
    }
  }, [isOnline, wasOffline]);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      className={`
        fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2
        px-4 py-2 text-sm font-medium text-white transition-all duration-300
        ${isOnline ? 'bg-green-600' : 'bg-gray-800'}
      `}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {isOnline ? (
        <>
          <Wifi size={15} />
          <span>Back online</span>
        </>
      ) : (
        <>
          <WifiOff size={15} />
          <span>No internet connection — some features may be unavailable</span>
        </>
      )}
    </div>
  );
}
