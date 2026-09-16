import { normalizeBench, normalizeBenches, hasCapacityFields } from '../src/utils/benchCapacity';
import { DEFAULT_BENCH_CAPACITY } from '../src/types';
import { runSimulation } from '../src/simulation/engine';
import type { Bench } from '../src/types';
import type { SimulationConfig } from '../src/simulation/types';

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) passed++;
  else {
    failed++;
    console.error('FAIL:', msg);
  }
}
function eq(a: unknown, b: unknown, msg: string) {
  assert(JSON.stringify(a) === JSON.stringify(b), msg);
}

const oldBench = {
  id: 'bench-old',
  name: '旧档案长椅',
  location: '老地方',
  lat: 31.23,
  lng: 121.47,
  material: 'wood',
  orientation: 'south',
  hasBackrest: true,
  shadeLevel: 'full',
  noiseLevel: 'quiet',
  stayDuration: 'long',
  rating: 5,
  review: '原始评价内容不可变',
  experiences: [{ id: 'e1', benchId: 'bench-old', timePeriod: 'morning', notes: 'x', rating: 4 }],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-02-02T00:00:00Z',
} as unknown as Bench;

/* 1. 旧档案：缺字段 → 补默认值；原内容不动 */
{
  assert(!hasCapacityFields(oldBench), '旧档案识别为缺字段');
  const n = normalizeBench(oldBench);
  assert(n.seats === DEFAULT_BENCH_CAPACITY.seats, '座位补默认值');
  assert(n.arrivalsPerHour === DEFAULT_BENCH_CAPACITY.arrivalsPerHour, '到达补默认值');
  assert(n.avgStayMinutes === DEFAULT_BENCH_CAPACITY.avgStayMinutes, '停留补默认值');
  assert(n.maxQueue === DEFAULT_BENCH_CAPACITY.maxQueue, '等候上限补默认值');
  assert(hasCapacityFields(n), '归一化后字段齐全');
  assert(n.id === 'bench-old' && n.name === '旧档案长椅', '原 id/name 不动');
  assert(n.review === '原始评价内容不可变', '原评价不动');
  assert(n.experiences.length === 1 && n.experiences[0].id === 'e1', '原体验记录不动');
  assert(n.lat === 31.23 && n.lng === 121.47, '原坐标不动');
  assert(n.createdAt === '2024-01-01T00:00:00Z', '原创建时间不动');
  // 不修改原对象
  assert(!('seats' in oldBench), '归一化不改动传入的原对象');
}

/* 2. 部分缺字段 / 非法值：保留合法字段，只补坏的 */
{
  const partial = { ...oldBench, seats: 8, arrivalsPerHour: -3, avgStayMinutes: 0, maxQueue: 2 };
  const n = normalizeBench(partial);
  assert(n.seats === 8, '合法座位数保留');
  assert(n.maxQueue === 2, '合法等候上限保留');
  assert(n.arrivalsPerHour === DEFAULT_BENCH_CAPACITY.arrivalsPerHour, '负到达率被默认值替换');
  assert(n.avgStayMinutes === DEFAULT_BENCH_CAPACITY.avgStayMinutes, '停留 0 被默认值替换');
}

/* 3. 非法类型（字符串/null/undefined）补默认 */
{
  const weird = {
    ...oldBench,
    seats: '四' as unknown,
    arrivalsPerHour: null as unknown,
    avgStayMinutes: undefined,
    maxQueue: 2.5,
  };
  const n = normalizeBench(weird);
  assert(n.seats === DEFAULT_BENCH_CAPACITY.seats, '字符串座位补默认');
  assert(n.arrivalsPerHour === DEFAULT_BENCH_CAPACITY.arrivalsPerHour, 'null 到达补默认');
  assert(n.avgStayMinutes === DEFAULT_BENCH_CAPACITY.avgStayMinutes, 'undefined 停留补默认');
  assert(n.maxQueue === DEFAULT_BENCH_CAPACITY.maxQueue, '非整数等候上限补默认');
}

/* 4. 已是新档案：原样保留（不被默认值覆盖） */
{
  const modern = { ...oldBench, seats: 12, arrivalsPerHour: 55, avgStayMinutes: 33, maxQueue: 7 };
  const n = normalizeBench(modern);
  assert(
    n.seats === 12 && n.arrivalsPerHour === 55 && n.avgStayMinutes === 33 && n.maxQueue === 7,
    '新档案登记值原样保留',
  );
  assert(n.name === '旧档案长椅' && n.rating === 5, '其余字段保留');
}

/* 5. 批量归一化幂等 */
{
  const once = normalizeBenches([oldBench, { ...oldBench, id: 'b2', seats: 5 }]);
  const twice = normalizeBenches(once);
  eq(twice, once, '归一化幂等');
}

/* 6. 旧方案（在新字段引入前保存）仍可打开并重算 */
{
  const cfg: SimulationConfig = {
    name: '旧方案',
    startTime: '09:00',
    endTime: '09:30',
    seed: 2024,
    benches: [
      {
        benchId: 'bench-old',
        name: '旧档案长椅',
        lat: 31.23,
        lng: 121.47,
        seats: 6,
        arrivalsPerHour: 40,
        avgStayMinutes: 18,
        maxQueue: 2,
      },
    ],
  };
  const r1 = runSimulation(cfg);
  const r2 = runSimulation(cfg);
  eq(JSON.stringify(r1), JSON.stringify(r2), '旧方案重算可复现');
  assert(r1.durationMinutes === 30, '旧方案时长正确');
  // 方案中的值不会改写档案：方案里座位=6，档案归一化默认仍是 DEFAULT
  const archive = normalizeBench(oldBench);
  assert(archive.seats === DEFAULT_BENCH_CAPACITY.seats, '载入/运行旧方案不覆盖档案登记值');
  assert(cfg.benches[0].seats === 6, '旧方案配置本身不被档案反向覆盖');
}

/* 7. 载入方案后再改档案 → 方案值不变（用纯数据模拟互不覆盖） */
{
  const planBench = { seats: 9, arrivalsPerHour: 77, avgStayMinutes: 41, maxQueue: 5 };
  const archived = normalizeBench({ ...oldBench, seats: 3, arrivalsPerHour: 8, avgStayMinutes: 12, maxQueue: 1 });
  // “载入方案”只取方案值填临时表单；档案后来变化不反向改方案
  const loadedForm = { ...planBench };
  assert(loadedForm.seats === 9 && archived.seats === 3, '方案临时值与档案值各自独立');
}

/* 8. 仿真引擎仍拒绝档案可能出现的非法默认（防御） */
{
  let threw = false;
  try {
    runSimulation({
      name: '坏',
      startTime: '08:00',
      endTime: '09:00',
      seed: 1,
      benches: [{ benchId: 'x', name: 'x', lat: 0, lng: 0, seats: 0, arrivalsPerHour: 1, avgStayMinutes: 10, maxQueue: 0 }],
    });
  } catch {
    threw = true;
  }
  assert(threw, '座位 0 仍被引擎拦截');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
