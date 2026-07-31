import { Plan, PlanLimits } from '@/types';

export const FREE_PLAN_LIMITS: PlanLimits = {
  workspaces: 1,
  aiCallsPerMonth: 20,
  assistantMessagesPerMonth: 50,
  pdfUploads: 2,
  badgeMints: 1,
  sourcesPerWorkspace: 3,
  problemUploadsPerMonth: 5,
};

export const PRO_PLAN_LIMITS: PlanLimits = {
  workspaces: 100, // Effectively unlimited
  aiCallsPerMonth: 1000,
  assistantMessagesPerMonth: 2500,
  pdfUploads: 100,
  badgeMints: 50,
  sourcesPerWorkspace: 20,
  problemUploadsPerMonth: 200,
};

export function getPlanLimits(plan: Plan): PlanLimits {
  return plan === 'pro' ? PRO_PLAN_LIMITS : FREE_PLAN_LIMITS;
}
