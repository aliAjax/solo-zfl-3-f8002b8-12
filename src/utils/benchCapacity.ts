import { DEFAULT_BENCH_CAPACITY } from '@/types';
import type { Bench } from '@/types';

type CapacityField = keyof typeof DEFAULT_BENCH_CAPACITY;

const FIELD_RULES: Record<CapacityField, { isValid: (v: number) => boolean }> = {
  // 座位数：正整数
  seats: { isValid: (v) => Number.isFinite(v) && Number.isInteger(v) && v > 0 },
  // 每小时到达人数：非负数
  arrivalsPerHour: { isValid: (v) => Number.isFinite(v) && v >= 0 },
  // 平均停留分钟：正数
  avgStayMinutes: { isValid: (v) => Number.isFinite(v) && v > 0 },
  // 等候上限：非负整数
  maxQueue: { isValid: (v) => Number.isFinite(v) && Number.isInteger(v) && v >= 0 },
};

/**
 * 为缺少/损坏仿真登记字段的旧档案补默认值。
 * 只读取并新增这四项，原有内容一律不动；返回的是浅拷贝。
 */
export function normalizeBench<T extends Partial<Bench>>(bench: T): T & Pick<Bench, CapacityField> {
  const result = { ...bench } as T & Pick<Bench, CapacityField>;
  (Object.keys(FIELD_RULES) as CapacityField[]).forEach((field) => {
    const value = (bench as Partial<Bench>)[field] as unknown;
    if (typeof value !== 'number' || !FIELD_RULES[field].isValid(value)) {
      (result as Record<CapacityField, number>)[field] = DEFAULT_BENCH_CAPACITY[field];
    } else {
      (result as Record<CapacityField, number>)[field] = value;
    }
  });
  return result;
}

/** 批量归一化旧档案 */
export function normalizeBenches<T extends Partial<Bench>>(benches: T[]): (T & Pick<Bench, CapacityField>)[] {
  return benches.map(normalizeBench);
}

/** 判断档案是否已包含全部合法的仿真登记字段（即无需迁移） */
export function hasCapacityFields(bench: Partial<Bench>): boolean {
  return (Object.keys(FIELD_RULES) as CapacityField[]).every(
    (field) =>
      typeof bench[field] === 'number' && FIELD_RULES[field].isValid(bench[field] as number),
  );
}
