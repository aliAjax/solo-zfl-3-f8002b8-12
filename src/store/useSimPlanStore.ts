import { create } from 'zustand';
import type { SimulationResult } from '@/simulation/types';
import { loadPlans, savePlans, type SavedPlan } from '@/utils/simStorage';
import { generateId } from '@/utils/comfort';

interface SimPlanState {
  plans: SavedPlan[];
  initialized: boolean;
  initialize: () => void;
  savePlan: (result: SimulationResult) => SavedPlan;
  deletePlan: (id: string) => void;
  getPlan: (id: string) => SavedPlan | undefined;
}

export const useSimPlanStore = create<SimPlanState>((set, get) => ({
  plans: [],
  initialized: false,

  initialize: () => {
    set({ plans: loadPlans(), initialized: true });
  },

  savePlan: (result) => {
    const plan: SavedPlan = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      result,
    };
    const plans = [plan, ...get().plans];
    set({ plans });
    savePlans(plans);
    return plan;
  },

  deletePlan: (id) => {
    const plans = get().plans.filter((p) => p.id !== id);
    set({ plans });
    savePlans(plans);
  },

  getPlan: (id) => get().plans.find((p) => p.id === id),
}));
