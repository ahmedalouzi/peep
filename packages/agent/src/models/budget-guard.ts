import { db } from './db';
import type { AIError } from '@peep/shared';

export interface PlanLimits {
  maxRequestCost: number;
  dailyBudget: number;
  monthlyBudget: number;
}

export class ServerBudgetGuard {
  // Plan limits configured server-side
  private planLimits: Record<string, PlanLimits> = {
    free: { maxRequestCost: 0.002, dailyBudget: 0.01, monthlyBudget: 0.10 },
    pro: { maxRequestCost: 0.05, dailyBudget: 0.50, monthlyBudget: 10.00 }
  };

  // Mutex locks to prevent concurrent race conditions / double spending locally
  private userLocks = new Set<string>();

  constructor() {}

  async acquireLock(userId: string): Promise<void> {
    while (this.userLocks.has(userId)) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    this.userLocks.add(userId);
  }

  releaseLock(userId: string): void {
    this.userLocks.delete(userId);
  }

  async checkBudget(userId: string, plan: string, estimatedCost: number): Promise<void> {
    const limits = this.planLimits[plan] || this.planLimits.free;

    // 1. Per-request limit check
    if (estimatedCost > limits.maxRequestCost) {
      const err: AIError = {
        code: 'BUDGET_EXCEEDED',
        message: `Request cost of $${estimatedCost} exceeds the max cost limit of $${limits.maxRequestCost} for ${plan} tier.`
      };
      throw err;
    }

    // 2. Accumulated usage check via atomic DB queries
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0,0,0,0);

    const res = await db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN timestamp >= $2 THEN estimated_cost ELSE 0 END), 0) as daily_cost,
        COALESCE(SUM(CASE WHEN timestamp >= $3 THEN estimated_cost ELSE 0 END), 0) as monthly_cost
      FROM usage_records 
      WHERE user_id = $1 AND status = 'success'
    `, [userId, today, monthStart]);

    const dailyCost = parseFloat(res.rows[0].daily_cost);
    const monthlyCost = parseFloat(res.rows[0].monthly_cost);

    if (dailyCost + estimatedCost > limits.dailyBudget) {
      const err: AIError = {
        code: 'BUDGET_EXCEEDED',
        message: `Exceeds the daily budget limit of $${limits.dailyBudget}. Current daily spent: $${dailyCost}.`
      };
      throw err;
    }

    if (monthlyCost + estimatedCost > limits.monthlyBudget) {
      const err: AIError = {
        code: 'BUDGET_EXCEEDED',
        message: `Exceeds the monthly budget limit of $${limits.monthlyBudget}. Current monthly spent: $${monthlyCost}.`
      };
      throw err;
    }
  }
}
