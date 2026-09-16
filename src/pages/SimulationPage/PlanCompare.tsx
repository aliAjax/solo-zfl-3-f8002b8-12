import { Trash2, GitCompare } from 'lucide-react';
import type { SavedPlan } from '@/utils/simStorage';

/** 高亮一行中最优值（可指定越大越好/越小越好） */
function bestClass(values: number[], index: number, lower = false): string {
  const target = lower ? Math.min(...values) : Math.max(...values);
  return values[index] === target ? 'font-semibold text-moss-green' : '';
}

export default function PlanCompare({
  plans,
  onDelete,
  onLoad,
}: {
  plans: SavedPlan[];
  onDelete: (id: string) => void;
  onLoad: (plan: SavedPlan) => void;
}) {
  if (plans.length === 0) {
    return (
      <div className="paper-texture rounded-xl shadow-paper p-8 text-center">
        <GitCompare className="w-8 h-8 text-moss-green/40 mx-auto mb-3" />
        <p className="text-sm text-ink-light">
          还没有保存方案。运行仿真后点击「保存方案」，即可在此并排比较峰值与流失。
        </p>
      </div>
    );
  }

  const globalRows: {
    label: string;
    get: (p: SavedPlan) => number;
    format?: (v: number) => string;
    lower?: boolean;
  }[] = [
    { label: '总到达', get: (p) => p.result.totalArrivals },
    { label: '获得服务', get: (p) => p.result.totalServed },
    {
      label: '占用峰值',
      get: (p) => p.result.peakOccupancy,
    },
    { label: '排队峰值', get: (p) => p.result.peakQueue, lower: true },
    { label: '满座累计(分)', get: (p) => p.result.totalFullMinutes, lower: true },
    { label: '流失人数', get: (p) => p.result.totalLost, lower: true },
    { label: '结束清队', get: (p) => p.result.queueCleared, lower: true },
  ];

  // 所有方案中出现过的长椅（按名称对齐）
  const benchNames = Array.from(
    new Set(
      plans.flatMap((p) => p.result.benchResults.map((b) => `${b.benchId}::${b.name}`)),
    ),
  );

  return (
    <div className="space-y-5">
      <div className="paper-texture rounded-xl shadow-paper p-5 overflow-x-auto">
        <h4 className="font-serif text-base font-semibold text-deep-brown mb-3">
          方案并排比较
        </h4>
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-left text-xs text-ink-light border-b border-deep-brown/10">
              <th className="py-2 pr-3 font-medium">指标</th>
              {plans.map((p) => (
                <th key={p.id} className="py-2 px-3 font-medium align-bottom">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => onLoad(p)}
                      className="text-left text-deep-brown hover:text-moss-green transition-colors"
                      title="载入此方案配置"
                    >
                      {p.result.config.name}
                    </button>
                    <button
                      onClick={() => onDelete(p.id)}
                      className="text-ink-light/50 hover:text-red-500 transition-colors w-fit"
                      title="删除方案"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="text-xs text-ink-light/80 border-b border-deep-brown/5">
              <td className="py-1.5 pr-3">参数</td>
              {plans.map((p) => (
                <td key={p.id} className="py-1.5 px-3">
                  {p.result.config.startTime}–{p.result.config.endTime} · 种子{' '}
                  {p.result.config.seed}
                </td>
              ))}
            </tr>
            {globalRows.map((row) => {
              const values = plans.map((p) => row.get(p));
              return (
                <tr
                  key={row.label}
                  className="border-b border-deep-brown/5 last:border-0"
                >
                  <td className="py-2 pr-3 text-ink-light">{row.label}</td>
                  {plans.map((p, i) => {
                    const v = row.get(p);
                    return (
                      <td
                        key={p.id}
                        className={`py-2 px-3 ${bestClass(values, i, row.lower)}`}
                      >
                        {row.format ? row.format(v) : v}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-ink-light mt-3">
          <span className="text-moss-green font-medium">绿色</span>
          为该指标最优（流失、排队、满座时长越低越好）；点方案名称可载入其配置。
        </p>
      </div>

      {/* 分长椅：峰值与流失 */}
      <div className="paper-texture rounded-xl shadow-paper p-5 overflow-x-auto">
        <h4 className="font-serif text-base font-semibold text-deep-brown mb-3">
          分长椅对比（占用峰 / 排队峰 / 流失）
        </h4>
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-left text-xs text-ink-light border-b border-deep-brown/10">
              <th className="py-2 pr-3 font-medium">长椅</th>
              {plans.map((p) => (
                <th key={p.id} className="py-2 px-3 font-medium text-deep-brown">
                  {p.result.config.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {benchNames.map((key) => {
              const [, name] = key.split('::');
              const cells = plans.map((p) => ({
                p,
                b: p.result.benchResults.find((x) => `${x.benchId}::${x.name}` === key),
              }));
              const lostVals = cells.map((c) => c.b?.lost ?? Infinity);
              const peakVals = cells.map((c) => c.b?.peakOccupancy ?? -1);
              return (
                <tr
                  key={key}
                  className="border-b border-deep-brown/5 last:border-0"
                >
                  <td className="py-2 pr-3 text-deep-brown font-medium">{name}</td>
                  {cells.map(({ p, b }, i) => (
                    <td key={p.id} className="py-2 px-3 text-xs whitespace-nowrap">
                      {b ? (
                        <span>
                          峰{' '}
                          <span className={bestClass(peakVals, i, false)}>
                            {b.peakOccupancy}
                          </span>
                          {' / '}队 {b.peakQueue}
                          {' / '}
                          <span className={bestClass(lostVals, i, true)}>
                            流失 {b.lost}
                          </span>
                        </span>
                      ) : (
                        <span className="text-ink-light/40">未参与</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
