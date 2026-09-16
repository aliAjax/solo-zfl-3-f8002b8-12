import type { SimulationResult } from '@/simulation/types';

/** 已保存的仿真方案：配置 + 结果一并持久化，刷新后仍可复现对比 */
export interface SavedPlan {
  id: string;
  createdAt: string;
  result: SimulationResult;
}

const STORAGE_KEY = 'bench-simulation-plans';

export function loadPlans(): SavedPlan[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed as SavedPlan[];
    }
  } catch (error) {
    console.error('Failed to load simulation plans from localStorage:', error);
  }
  return [];
}

export function savePlans(plans: SavedPlan[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  } catch (error) {
    console.error('Failed to save simulation plans to localStorage:', error);
  }
}
