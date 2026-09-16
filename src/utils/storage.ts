import type { Bench } from '@/types';
import { normalizeBenches, hasCapacityFields } from './benchCapacity';

const STORAGE_KEY = 'bench-archive-data';

export interface LoadResult {
  benches: Bench[];
  /** 读取到的旧档案是否缺字段、是否做过补默认值 */
  migrated: boolean;
}

export function loadBenchesWithFlag(): LoadResult {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        const raw = parsed as Partial<Bench>[];
        const migrated = raw.some((b) => !hasCapacityFields(b));
        // 旧档案缺少仿真登记字段时补默认值，原有内容不动
        return { benches: normalizeBenches(raw) as Bench[], migrated };
      }
    }
  } catch (error) {
    console.error('Failed to load benches from localStorage:', error);
  }
  return { benches: [], migrated: false };
}

export function loadBenches(): Bench[] {
  return loadBenchesWithFlag().benches;
}

export function saveBenches(benches: Bench[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(benches));
  } catch (error) {
    console.error('Failed to save benches to localStorage:', error);
  }
}

export function clearBenches(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear benches from localStorage:', error);
  }
}
