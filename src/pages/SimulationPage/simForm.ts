import type { Bench } from '@/types';
import { DEFAULT_BENCH_CAPACITY } from '@/types';
import type { SimBenchInput, SimulationConfig, ValidationErrors } from '@/simulation/types';
import { validateConfig } from '@/simulation/engine';

export interface SimFormState {
  name: string;
  startTime: string;
  endTime: string;
  seedText: string;
  benchParams: Record<
    string,
    {
      seats: string;
      arrivalsPerHour: string;
      avgStayMinutes: string;
      maxQueue: string;
    }
  >;
}

/** 以长椅档案的登记值为仿真表单默认值（旧档案由 store 归一化后必有合法值） */
export function benchParamsFromArchive(benches: Bench[]): SimFormState['benchParams'] {
  return Object.fromEntries(
    benches.map((b) => [
      b.id,
      {
        seats: String(b.seats ?? DEFAULT_BENCH_CAPACITY.seats),
        arrivalsPerHour: String(b.arrivalsPerHour ?? DEFAULT_BENCH_CAPACITY.arrivalsPerHour),
        avgStayMinutes: String(b.avgStayMinutes ?? DEFAULT_BENCH_CAPACITY.avgStayMinutes),
        maxQueue: String(b.maxQueue ?? DEFAULT_BENCH_CAPACITY.maxQueue),
      },
    ]),
  );
}

export function defaultFormState(benches: Bench[], opts?: { seed?: number }): SimFormState {
  const seed = opts?.seed;
  return {
    name: '',
    startTime: '08:00',
    endTime: '10:00',
    seedText: seed !== undefined ? String(seed) : '',
    benchParams: benchParamsFromArchive(benches),
  };
}

/** 将表单文本解析成仿真配置；解析失败由 errors 描述 */
export function buildConfig(
  form: SimFormState,
  benches: Bench[],
): { config: SimulationConfig; errors: ValidationErrors } {
  const errors: ValidationErrors = {};
  const seedNum = form.seedText.trim() === '' ? NaN : Number(form.seedText);

  const simBenches: SimBenchInput[] = [];
  benches.forEach((bench, i) => {
    const p = form.benchParams[bench.id];
    if (!p) return;
    const seats = Number(p.seats);
    const arrivalsPerHour = Number(p.arrivalsPerHour);
    const avgStayMinutes = Number(p.avgStayMinutes);
    const maxQueue = Number(p.maxQueue);
    if (!Number.isFinite(seats) || seats <= 0 || !Number.isInteger(seats)) {
      errors[`benches.${i}.seats`] = '座位数必须为正整数（不能为零）';
    }
    if (!Number.isFinite(arrivalsPerHour) || arrivalsPerHour < 0) {
      errors[`benches.${i}.arrivalsPerHour`] = '每小时到达人数不能为负';
    }
    if (!Number.isFinite(avgStayMinutes) || avgStayMinutes <= 0) {
      errors[`benches.${i}.avgStayMinutes`] = '平均停留分钟必须为正数';
    }
    if (!Number.isFinite(maxQueue) || maxQueue < 0 || !Number.isInteger(maxQueue)) {
      errors[`benches.${i}.maxQueue`] = '等候上限必须为非负整数';
    }
    if (
      Number.isFinite(seats) &&
      seats > 0 &&
      Number.isFinite(arrivalsPerHour) &&
      arrivalsPerHour >= 0 &&
      Number.isFinite(avgStayMinutes) &&
      avgStayMinutes > 0 &&
      Number.isFinite(maxQueue) &&
      maxQueue >= 0
    ) {
      simBenches.push({
        benchId: bench.id,
        name: bench.name,
        lat: bench.lat,
        lng: bench.lng,
        seats,
        arrivalsPerHour,
        avgStayMinutes,
        maxQueue,
      });
    }
  });

  const config: SimulationConfig = {
    name: form.name.trim(),
    startTime: form.startTime,
    endTime: form.endTime,
    seed: Number.isFinite(seedNum) ? Math.trunc(seedNum) : NaN,
    benches: simBenches,
  };

  // 引擎校验（时间倒置、种子缺失、名称等）
  const engineErrors = Object.keys(errors).length === 0 ? validateConfig(config) : {};
  return { config, errors: { ...errors, ...engineErrors } };
}
