import { runSimulation, validateConfig, hashSeed, createRng } from '../src/simulation/engine';
import type { SimulationConfig } from '../src/simulation/types';

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error('FAIL:', msg);
  }
}
function approx(a: number, b: number, eps = 1e-9) {
  return Math.abs(a - b) <= eps;
}

/* 1. PRNG 确定性 */
{
  const a = createRng(hashSeed(123));
  const b = createRng(hashSeed(123));
  const seqA = Array.from({ length: 1000 }, () => a());
  const seqB = Array.from({ length: 1000 }, () => b());
  assert(seqA.every((v, i) => v === seqB[i]), '相同种子 PRNG 序列一致');
  const c = createRng(hashSeed(124));
  assert(c() !== seqA[0], '不同种子 PRNG 序列不同');
  assert(hashSeed('42') === hashSeed('42'), '字符串种子哈希稳定');
}

const bench = (
  benchId: string,
  name: string,
  seats: number,
  arrivalsPerHour: number,
  avgStayMinutes: number,
  maxQueue: number,
  lat: number,
  lng: number,
) => ({ benchId, name, seats, arrivalsPerHour, avgStayMinutes, maxQueue, lat, lng });

const baseConfig = (over: Partial<SimulationConfig> = {}): SimulationConfig => ({
  name: '测试方案',
  startTime: '08:00',
  endTime: '10:00',
  seed: 7,
  benches: [
    bench('b1', '甲长椅', 4, 30, 15, 2, 31.23, 121.47),
    bench('b2', '乙长椅', 3, 20, 25, 1, 31.24, 121.48),
    bench('b3', '丙长椅', 5, 10, 40, 3, 31.30, 121.50),
  ],
  ...over,
});

/* 2. 同输入同种子结果完全一致 */
{
  const r1 = runSimulation(baseConfig());
  const r2 = runSimulation(baseConfig());
  assert(JSON.stringify(r1) === JSON.stringify(r2), '同配置同种子结果深一致（含每分钟快照）');
  const r3 = runSimulation(baseConfig({ seed: 8 }));
  assert(JSON.stringify(r1) !== JSON.stringify(r3), '不同种子结果不同');
}

/* 3. 快照与时长 */
{
  const r = runSimulation(baseConfig());
  assert(r.durationMinutes === 120, '08:00–10:00 时长 120 分钟');
  assert(r.snapshots.length === 120, '快照数 = 120');
  assert(r.snapshots[0].minute === 0 && r.snapshots[0].time === '08:00', '首分钟时间标签 08:00');
  assert(r.snapshots[119].time === '09:59', '末分钟时间标签 09:59');
  for (const s of r.snapshots) {
    for (const pb of s.perBench) {
      assert(pb.occupied >= 0 && pb.queue >= 0, '占用与排队非负');
      assert(pb.full === (pb.occupied === (r.benchResults.find((b) => b.benchId === pb.benchId)?.seats ?? -1)), '满座标记正确');
    }
    assert(
      s.totalOccupied === s.perBench.reduce((x, y) => x + y.occupied, 0) &&
        s.totalQueue === s.perBench.reduce((x, y) => x + y.queue, 0),
      '合计与明细一致',
    );
  }
}

/* 4. 守恒：到达 = 服务 + 流失 + 结束清队（全局） */
{
  const r = runSimulation(baseConfig());
  assert(
    r.totalArrivals === r.totalServed + r.totalLost + r.queueCleared,
    `守恒：到达(${r.totalArrivals}) = 服务(${r.totalServed}) + 流失(${r.totalLost}) + 清队(${r.queueCleared})`,
  );
  assert(r.peakOccupancy === Math.max(...r.snapshots.map((s) => s.totalOccupied)), '占用峰值正确');
  assert(r.peakQueue === Math.max(...r.snapshots.map((s) => s.totalQueue)), '排队峰值正确');
  assert(
    r.totalFullMinutes === r.benchResults.reduce((s, b) => s + b.fullMinutes, 0),
    '满座分钟合计正确',
  );
}

/* 5. 排队补位 & 结束清队：单椅、到达极多、座位2、等候1、停留很短 */
{
  const cfg = baseConfig({
    benches: [bench('b1', '唯一长椅', 2, 600, 1, 1, 31.23, 121.47)],
    endTime: '08:05',
  });
  const r = runSimulation(cfg);
  const b1 = r.benchResults[0];
  // 第 0 分钟：2 人入座（停留 1 分钟），1 人排队，其余因排队满且无处转投而流失
  assert(b1.peakOccupancy === 2, '占用峰值 = 座位数');
  assert(b1.peakQueue <= 1, '排队峰值不超过等候上限');
  assert(b1.fullMinutes === 5, '5 分钟全程满座');
  // 结束时刻清空排队
  const last = r.snapshots[r.snapshots.length - 1];
  assert(r.queueCleared === last.perBench[0].queue, '结束清队 = 末分钟排队数');
  assert(r.queueCleared > 0, '高压场景结束时确实有人在排队被清空');
  assert(b1.served === b1.seatedDirect + b1.seatedAfterWait, '服务 = 直接入座 + 排队入座');
}

/* 6. 转投：近处有空位长椅时不流失 */
{
  // b1 座位极少、到达极高；b2 在旁边且容量巨大 → b1 溢出者应转投 b2
  const cfg = baseConfig({
    benches: [
      bench('b1', '拥挤长椅', 1, 600, 90, 0, 31.2300, 121.4700),
      bench('b2', '邻近长椅', 100, 0, 30, 0, 31.2301, 121.4701),
      bench('b3', '远处长椅', 100, 0, 30, 0, 32.0000, 122.0000),
    ],
    endTime: '08:03',
  });
  const r = runSimulation(cfg);
  const [b1, b2, b3] = r.benchResults;
  assert(b2.redirectedIn > 0, '邻近长椅收到转投者');
  assert(b2.redirectedIn >= b3.redirectedIn, '优先转投最近长椅');
  assert(b1.redirectedOut === b2.redirectedIn + b3.redirectedIn + b1.lost, '转出 = 各转入 + 流失');
}

/* 7. 流失：全部满座且排队超限 */
{
  const cfg = baseConfig({
    benches: [
      bench('b1', '甲', 1, 600, 90, 0, 31.23, 121.47),
      bench('b2', '乙', 1, 600, 90, 0, 31.24, 121.48),
    ],
    endTime: '08:02',
  });
  const r = runSimulation(cfg);
  assert(r.totalLost > 0, '无处可去时记流失');
  assert(
    r.totalLost === r.benchResults.reduce((s, b) => s + b.lost, 0),
    '流失按来源长椅合计',
  );
}

/* 8. 零到达：全空 */
{
  const cfg = baseConfig({
    benches: [bench('b1', '空长椅', 4, 0, 20, 2, 31.23, 121.47)],
  });
  const r = runSimulation(cfg);
  assert(r.totalArrivals === 0 && r.totalServed === 0 && r.totalLost === 0, '零到达全空');
  assert(r.snapshots.every((s) => s.totalOccupied === 0 && s.totalQueue === 0), '零到达快照全零');
  assert(r.benchResults[0].avgUtilization === 0, '零到达利用率 0');
}

/* 9. 校验拦截 */
{
  const badSeats = validateConfig(baseConfig({ benches: [bench('b1', '甲', 0, 10, 20, 1, 31.23, 121.47)] }));
  assert(!!badSeats['benches.0.seats'], '座位为零被拦截');

  const negArrivals = validateConfig(baseConfig({
    benches: [bench('b1', '甲', 3, -5, 20, 1, 31.23, 121.47)],
  }));
  assert(!!negArrivals['benches.0.arrivalsPerHour'], '到达人数为负被拦截');

  const negStay = validateConfig(baseConfig({
    benches: [bench('b1', '甲', 3, 10, -20, 1, 31.23, 121.47)],
  }));
  assert(!!negStay['benches.0.avgStayMinutes'], '停留分钟为负被拦截');

  const reversed = validateConfig(baseConfig({ startTime: '10:00', endTime: '08:00' }));
  assert(!!reversed.endTime, '时间倒置被拦截');
  const equal = validateConfig(baseConfig({ startTime: '08:00', endTime: '08:00' }));
  assert(!!equal.endTime, '起止相等被拦截');
  const badFmt = validateConfig(baseConfig({ startTime: '8点', endTime: '10:00' }));
  assert(!!badFmt.startTime, '时间格式错误被拦截');

  const noSeed = validateConfig(baseConfig({ seed: NaN }));
  assert(!!noSeed.seed, '种子缺失被拦截');
  const noName = validateConfig(baseConfig({ name: '' }));
  assert(!!noName.name, '方案名为空被拦截');
  const noBenches = validateConfig(baseConfig({ benches: [] }));
  assert(!!noBenches.benches, '没有长椅被拦截');

  let threw = false;
  try {
    runSimulation(baseConfig({ seed: NaN }));
  } catch {
    threw = true;
  }
  assert(threw, 'runSimulation 对无效配置抛错');
}

/* 10. 长停留占用不会超过座位数；利用率在 [0,1] */
{
  const r = runSimulation(baseConfig());
  for (const b of r.benchResults) {
    assert(b.peakOccupancy <= b.seats, `${b.name} 占用峰值不超过座位`);
    assert(b.avgUtilization >= 0 && b.avgUtilization <= 1, `${b.name} 利用率在 0~1`);
    assert(approx(b.avgUtilization, Math.round(b.avgUtilization * 1000) / 1000), '利用率保留三位小数');
  }
}

/* 11. 名称排序处理是确定的：构造同分钟多人溢出，结果稳定且守恒（已在 #2/#4 覆盖），
   此处验证姓名排序比较器对不同名字给出确定顺序（通过两次结果一致间接保证） */
{
  const cfg = baseConfig({
    benches: [
      bench('b1', '甲', 2, 200, 30, 5, 31.23, 121.47),
      bench('b2', '乙', 2, 200, 30, 5, 31.231, 121.471),
    ],
    endTime: '08:10',
    seed: 99,
  });
  const r1 = runSimulation(cfg);
  const r2 = runSimulation(cfg);
  assert(JSON.stringify(r1.snapshots) === JSON.stringify(r2.snapshots), '高压下同名次处理顺序确定');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
