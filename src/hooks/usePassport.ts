import { useState, useEffect } from 'react';
import { Badge } from '@/types';

export function usePassport() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBadges() {
      try {
        const res = await fetch('/api/passport/badges');
        if (!res.ok) throw new Error('Failed to fetch passport badges');
        const data = await res.json();
        setBadges(data.badges || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchBadges();
  }, []);

  return { badges, loading, error };
}
