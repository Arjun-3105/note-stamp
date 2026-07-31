'use client';

/**
 * usePlan — fetches the current user's plan from the server and exposes helpers.
 */
import { useState, useEffect } from 'react';

export type Plan = 'free' | 'pro';

export interface UsePlanReturn {
  plan: Plan;
  isPro: boolean;
  isLoading: boolean;
  error: string | null;
}

export function usePlan(): UsePlanReturn {
  const [plan, setPlan] = useState<Plan>('free');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const res = await fetch('/api/user/me');
        if (!res.ok) throw new Error('Failed to fetch user plan');
        const data = await res.json();
        setPlan(data.plan || 'free');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlan();
  }, []);

  return {
    plan,
    isPro: plan === 'pro',
    isLoading,
    error,
  };
}
