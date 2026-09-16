import type {
  BenchMinuteState,
  BenchSimResult,
  MinuteSnapshot,
  SimBenchInput,
  SimulationConfig,
  SimulationResult,
  ValidationErrors,
} from './types';

/* ------------------------------------------------------------------ */
/* 确定性随机数：同一种子产出同一序列，不依赖 Date.now / Math.random    */
/* ------------------------------------------------------------------ */

/** 字符串/数字种子混合为 32 位整数（xmur3 哈希） */
export function hashSeed(input: string | number): number {
  let h = 1779033703 ^ String(input).length;
  for (let i = 0; i < String(input).length; i++) {
    h = Math.imul(h ^ String(input).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32：确定性 32 位 PRNG */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* 抽样分布                                                             */
/* ------------------------------------------------------------------ */

/** 泊松抽样（每小时到达率 → 每分钟 λ） */
export function poissonDraw(rng: () => number, lambda: number): number {
  if (lambda <= 0) return 0;
  // λ 较大时改用正态近似，避免 Knuth 循环过多
  if (lambda >= 30) {
    const u1 = Math.max(rng(), 1e-12);
    const u2 = rng();
    const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normal));
  }
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > limit);
  return k - 1;
}

/** 指数分布抽样：平均停留 mean 分钟，至少 1 分钟 */
function exponentialDraw(rng: () => number, mean: number): number {
  if (mean <= 0) return 1;
  const u = Math.max(1e-12, 1 - rng());
  return Math.max(1, Math.round(-Math.log(u) * mean));
}

/* ------------------------------------------------------------------ */
/* 确定性姓名库（到达的人按名称排序处理）                                */
/* ------------------------------------------------------------------ */

const SURNAMES = [
  '王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴',
  '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗',
];

const GIVEN_NAMES = [
  '伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋',
  '勇', '艳', '杰', '娟', '涛', '明', '超', '霞', '平', '刚',
  '桂英', '秀兰', '建国', '建华', '志强', '晓明', '雪梅', '嘉怡',
  '子轩', '雨桐',
];

/** 不依赖 locale 的名称比较：逐码点比较，再以 id 兜底，保证可复现 */
function compareName(a: string, b: string): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ca = a.charCodeAt(i);
    const cb = b.charCodeAt(i);
    if (ca !== cb) return ca - cb;
  }
  return a.length - b.length;
}

/* ------------------------------------------------------------------ */
/* 时间与距离工具                                                       */
/* ------------------------------------------------------------------ */

/** "HH:MM" → 当日分钟数；非法返回 null */
export function parseTimeToMinutes(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

/** 当日分钟数 → "HH:MM" */
export function formatMinutes(value: number): string {
  const h = Math.floor(value / 60) % 24;
  const min = value % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** 经纬度等距近似距离（公里），仅用于最近长椅排序 */
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* ------------------------------------------------------------------ */
/* 输入校验                                                             */
/* ------------------------------------------------------------------ */

export function validateConfig(config: SimulationConfig): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!config.name.trim()) errors.name = '请填写方案名称';

  if (!Number.isFinite(config.seed)) errors.seed = '随机种子缺失，请填写整数种子';

  const start = parseTimeToMinutes(config.startTime);
  const end = parseTimeToMinutes(config.endTime);
  if (start === null) errors.startTime = '开始时间格式应为 HH:MM';
  if (end === null) errors.endTime = '结束时间格式应为 HH:MM';
  if (start !== null && end !== null && end <= start) {
    errors.endTime = '结束时间必须晚于开始时间';
  }

  if (config.benches.length === 0) {
    errors.benches = '至少需要一张长椅';
  }

  const seenNames = new Set<string>();
  config.benches.forEach((b, i) => {
    const prefix = `benches.${i}`;
    if (!Number.isFinite(b.seats) || b.seats <= 0 || !Number.isInteger(b.seats)) {
      errors[`${prefix}.seats`] = '座位数必须为正整数（不能为零）';
    }
    if (!Number.isFinite(b.arrivalsPerHour) || b.arrivalsPerHour < 0) {
      errors[`${prefix}.arrivalsPerHour`] = '每小时到达人数不能为负';
    }
    if (!Number.isFinite(b.avgStayMinutes) || b.avgStayMinutes <= 0) {
      errors[`${prefix}.avgStayMinutes`] = '平均停留分钟必须为正数';
    }
    if (!Number.isFinite(b.maxQueue) || b.maxQueue < 0 || !Number.isInteger(b.maxQueue)) {
      errors[`${prefix}.maxQueue`] = '等候上限必须为非负整数';
    }
    if (seenNames.has(b.benchId)) {
      errors[`${prefix}.id`] = '长椅重复';
    }
    seenNames.add(b.benchId);
  });

  return errors;
}

export function isValidConfig(config: SimulationConfig): boolean {
  return Object.keys(validateConfig(config)).length === 0;
}

/* ------------------------------------------------------------------ */
/* 仿真引擎                                                             */
/* ------------------------------------------------------------------ */

interface Person {
  id: string;
  name: string;
  /** 停留分钟数（入座/入队时确定） */
  stayDur: number;
  /** 计划离开的分钟偏移（仅入座后有值） */
  departMinute: number | null;
  originId: string;
}

interface BenchRuntime {
  input: SimBenchInput;
  seated: Person[];
  queue: Person[];
  stats: BenchSimResult;
}

/**
 * 按分钟推进客流仿真。
 * 同一 config（含种子）重复调用必然得到同一结果。
 */
export function runSimulation(config: SimulationConfig): SimulationResult {
  const errors = validateConfig(config);
  if (Object.keys(errors).length > 0) {
    throw new Error(`仿真配置无效: ${Object.values(errors).join('；')}`);
  }

  const startMinute = parseTimeToMinutes(config.startTime)!;
  const endMinute = parseTimeToMinutes(config.endTime)!;
  const duration = endMinute - startMinute;

  const rng = createRng(hashSeed(config.seed));

  // 长椅按 id 稳定排序，决定 RNG 抽样顺序
  const orderedInputs = [...config.benches].sort((a, b) =>
    a.benchId < b.benchId ? -1 : a.benchId > b.benchId ? 1 : 0,
  );

  const runtimes = new Map<string, BenchRuntime>();
  for (const input of orderedInputs) {
    runtimes.set(input.benchId, {
      input,
      seated: [],
      queue: [],
      stats: {
        benchId: input.benchId,
        name: input.name,
        lat: input.lat,
        lng: input.lng,
        seats: input.seats,
        arrivalsPerHour: input.arrivalsPerHour,
        avgStayMinutes: input.avgStayMinutes,
        maxQueue: input.maxQueue,
        totalArrivals: 0,
        served: 0,
        seatedDirect: 0,
        seatedAfterWait: 0,
        redirectedIn: 0,
        redirectedOut: 0,
        lost: 0,
        peakQueue: 0,
        peakOccupancy: 0,
        fullMinutes: 0,
        avgUtilization: 0,
      },
    });
  }

  /** 决定一个人在某张长椅上的停留时长并入座/入队 */
  const commit = (rt: BenchRuntime, person: Person, minute: number, asQueue: boolean) => {
    person.stayDur = exponentialDraw(rng, rt.input.avgStayMinutes);
    if (asQueue) {
      rt.queue.push(person);
      person.departMinute = null;
    } else {
      person.departMinute = minute + person.stayDur;
      rt.seated.push(person);
      rt.stats.served += 1;
    }
  };

  /** 满座且排队超限后，按最近距离转投有空位的长椅；返回是否找到去处 */
  const redirect = (person: Person, from: BenchRuntime, minute: number): boolean => {
    let best: BenchRuntime | null = null;
    let bestDist = Infinity;
    for (const rt of runtimes.values()) {
      if (rt.input.benchId === from.input.benchId) continue;
      if (rt.seated.length >= rt.input.seats) continue; // 只去当前有空位的
      const d = distanceKm(
        from.input.lat,
        from.input.lng,
        rt.input.lat,
        rt.input.lng,
      );
      if (
        d < bestDist ||
        (d === bestDist && best !== null && rt.input.benchId < best.input.benchId)
      ) {
        best = rt;
        bestDist = d;
      }
    }
    if (!best) return false;
    // 在目标长椅按其平均停留时长重新抽样并立即入座
    best.stats.redirectedIn += 1;
    best.stats.seatedDirect += 1;
    commit(best, person, minute, false);
    return true;
  };

  const snapshots: MinuteSnapshot[] = [];
  let personSeq = 0;
  let totalLost = 0;

  for (let t = 0; t < duration; t++) {
    /* 1. 离开：到达停留时长的人腾出座位 */
    for (const rt of runtimes.values()) {
      rt.seated = rt.seated.filter((p) => p.departMinute !== t);
    }

    /* 2. 排队补位：按长椅 id 顺序，空位优先补给已在排队的人 */
    for (const rt of runtimes.values()) {
      while (rt.seated.length < rt.input.seats && rt.queue.length > 0) {
        const person = rt.queue.shift()!;
        person.departMinute = t + person.stayDur;
        rt.seated.push(person);
        rt.stats.served += 1;
        rt.stats.seatedAfterWait += 1;
      }
    }

    /* 3. 生成本分钟到达：各长椅按 id 顺序抽样（保证 RNG 序列确定） */
    const arrivals: Person[] = [];
    for (const rt of runtimes.values()) {
      const lambda = rt.input.arrivalsPerHour / 60;
      const count = poissonDraw(rng, lambda);
      rt.stats.totalArrivals += count;
      for (let i = 0; i < count; i++) {
        const surname = SURNAMES[Math.floor(rng() * SURNAMES.length)];
        const given = GIVEN_NAMES[Math.floor(rng() * GIVEN_NAMES.length)];
        personSeq += 1;
        arrivals.push({
          id: `p-${String(t).padStart(4, '0')}-${String(personSeq).padStart(5, '0')}`,
          name: surname + given,
          stayDur: 0,
          departMinute: null,
          originId: rt.input.benchId,
        });
      }
    }

    /* 4. 同一分钟到达的人按名称（再按 id）排序处理 */
    arrivals.sort((a, b) => compareName(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    /* 5. 逐一安排：入座 → 排队 → 转投 → 流失 */
    for (const person of arrivals) {
      const rt = runtimes.get(person.originId)!;
      if (rt.seated.length < rt.input.seats) {
        rt.stats.seatedDirect += 1;
        commit(rt, person, t, false);
      } else if (rt.queue.length < rt.input.maxQueue) {
        commit(rt, person, t, true);
      } else {
        rt.stats.redirectedOut += 1;
        const rescued = redirect(person, rt, t);
        if (!rescued) {
          totalLost += 1;
          rt.stats.lost += 1;
        }
      }
    }

    /* 6. 记录本分钟快照与峰值/满座 */
    const perBench: BenchMinuteState[] = orderedInputs.map((input) => {
      const rt = runtimes.get(input.benchId)!;
      const occupied = rt.seated.length;
      const queue = rt.queue.length;
      const full = occupied >= input.seats;
      if (full) rt.stats.fullMinutes += 1;
      if (occupied > rt.stats.peakOccupancy) rt.stats.peakOccupancy = occupied;
      if (queue > rt.stats.peakQueue) rt.stats.peakQueue = queue;
      return { benchId: input.benchId, occupied, queue, full };
    });

    const totalOccupied = perBench.reduce((s, x) => s + x.occupied, 0);
    const totalQueue = perBench.reduce((s, x) => s + x.queue, 0);
    snapshots.push({
      minute: t,
      time: formatMinutes(startMinute + t),
      totalOccupied,
      totalQueue,
      perBench,
    });
  }

  /* 结束时刻：清空所有排队（未获服务，不计入流失） */
  let queueCleared = 0;
  for (const rt of runtimes.values()) {
    queueCleared += rt.queue.length;
    rt.queue = [];
  }

  const benchResults = orderedInputs.map((input) => {
    const rt = runtimes.get(input.benchId)!;
    const occupancySum = snapshots.reduce(
      (s, snap) => s + (snap.perBench.find((x) => x.benchId === input.benchId)?.occupied ?? 0),
      0,
    );
    rt.stats.avgUtilization =
      duration > 0 ? Math.round((occupancySum / input.seats / duration) * 1000) / 1000 : 0;
    return { ...rt.stats };
  });

  return {
    config,
    durationMinutes: duration,
    snapshots,
    benchResults,
    totalArrivals: benchResults.reduce((s, b) => s + b.totalArrivals, 0),
    totalServed: benchResults.reduce((s, b) => s + b.served, 0),
    totalLost,
    queueCleared,
    peakOccupancy: snapshots.reduce((m, s) => Math.max(m, s.totalOccupied), 0),
    peakQueue: snapshots.reduce((m, s) => Math.max(m, s.totalQueue), 0),
    totalFullMinutes: benchResults.reduce((s, b) => s + b.fullMinutes, 0),
  };
}
