// 客流承载仿真相关类型

/** 单张长椅的仿真输入参数 */
export interface SimBenchInput {
  benchId: string;
  name: string;
  lat: number;
  lng: number;
  /** 座位数（正整数） */
  seats: number;
  /** 每小时到达人数（非负） */
  arrivalsPerHour: number;
  /** 平均停留分钟（正数） */
  avgStayMinutes: number;
  /** 等候上限：满座时最多允许多少人排队（非负整数） */
  maxQueue: number;
}

/** 一套仿真方案配置 */
export interface SimulationConfig {
  /** 方案名称 */
  name: string;
  /** 开始时间，格式 HH:MM */
  startTime: string;
  /** 结束时间，格式 HH:MM（须晚于开始时间） */
  endTime: string;
  /** 随机种子（整数，不可缺失） */
  seed: number;
  benches: SimBenchInput[];
}

/** 某一分钟的整体快照（含各长椅明细） */
export interface MinuteSnapshot {
  /** 距开始的分钟偏移，0 = 开始的第一分钟 */
  minute: number;
  /** 时钟标签 HH:MM */
  time: string;
  /** 全部长椅占用座位合计 */
  totalOccupied: number;
  /** 全部长椅排队人数合计 */
  totalQueue: number;
  perBench: BenchMinuteState[];
}

export interface BenchMinuteState {
  benchId: string;
  occupied: number;
  queue: number;
  /** 该分钟是否满座（占用 === 座位数） */
  full: boolean;
}

/** 单张长椅的仿真结果汇总 */
export interface BenchSimResult {
  benchId: string;
  name: string;
  lat: number;
  lng: number;
  seats: number;
  arrivalsPerHour: number;
  avgStayMinutes: number;
  maxQueue: number;
  /** 总到达（直接来到该长椅的人，含排队/转投/流失） */
  totalArrivals: number;
  /** 最终被服务人数（直接入座或排队后入座，含从别处转投来的） */
  served: number;
  /** 直接入座（到达时即有空位） */
  seatedDirect: number;
  /** 先排队后入座 */
  seatedAfterWait: number;
  /** 从其他长椅转投来此的人数 */
  redirectedIn: number;
  /** 因满座且排队超限，从这里转投别处的人数 */
  redirectedOut: number;
  /** 无处可去而流失的人数（按来源长椅计） */
  lost: number;
  /** 排队人数峰值 */
  peakQueue: number;
  /** 占用座位峰值 */
  peakOccupancy: number;
  /** 满座累计分钟数 */
  fullMinutes: number;
  /** 平均利用率 0~1（每分钟占用率的均值） */
  avgUtilization: number;
}

/** 整套仿真的结果 */
export interface SimulationResult {
  config: SimulationConfig;
  durationMinutes: number;
  snapshots: MinuteSnapshot[];
  benchResults: BenchSimResult[];
  /** 全局指标 */
  totalArrivals: number;
  totalServed: number;
  totalLost: number;
  /** 结束时刻被清空的排队人数（未获服务） */
  queueCleared: number;
  /** 全部长椅占用合计的峰值 */
  peakOccupancy: number;
  /** 全部长椅排队合计的峰值 */
  peakQueue: number;
  /** 所有长椅满座分钟数合计 */
  totalFullMinutes: number;
}

/** 校验错误：字段路径 -> 信息 */
export type ValidationErrors = Record<string, string>;
