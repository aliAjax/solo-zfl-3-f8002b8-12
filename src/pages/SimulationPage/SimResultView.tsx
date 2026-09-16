import {
  Users,
  UserCheck,
  UserX,
  Clock,
  TrendingUp,
  ListOrdered,
  TimerReset,
} from 'lucide-react';
import type { SimulationResult } from '@/simulation/types';

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  hint?: string;
  tone: 'moss' | 'ochre' | 'red' | 'brown' | 'blue';
}) {
  const toneMap = {
    moss: 'bg-moss-green/10 text-moss-green',
    ochre: 'bg-ochre/10 text-ochre',
    red: 'bg-red-500/10 text-red-500',
    brown: 'bg-deep-brown/10 text-deep-brown',
    blue: 'bg-sky-500/10 text-sky-600',
  };
  return (
    <div className="paper-texture rounded-xl shadow-paper p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${toneMap[tone]}`}>
          <Icon className="w-4 h-4" />
        </span>
        <span className="text-xs text-ink-light">{label}</span>
      </div>
      <div className="text-2xl font-serif font-semibold text-deep-brown">{value}</div>
      {hint && <p className="text-xs text-ink-light mt-1">{hint}</p>}
    </div>
  );
}

/** 占用率条带：每个分钟一格，颜色随利用率变化；满座描边；排队>0 加红点 */
function TimelineRow({
  result,
  benchId,
  label,
  seats,
}: {
  result: SimulationResult;
  benchId: string | null;
  label: string;
  seats: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 text-xs text-ink-light truncate" title={label}>
        {label}
      </div>
      <div className="flex-1 flex gap-px overflow-x-auto pb-1">
        {result.snapshots.map((snap) => {
          const st =
            benchId === null
              ? { occupied: snap.totalOccupied, queue: snap.totalQueue }
              : snap.perBench.find((b) => b.benchId === benchId) ?? {
                  occupied: 0,
                  queue: 0,
                };
          const ratio = seats > 0 ? Math.min(1, st.occupied / seats) : 0;
          const bg =
            ratio === 0
              ? 'bg-deep-brown/5'
              : ratio < 0.5
                ? 'bg-moss-light'
                : ratio < 1
                  ? 'bg-moss-green'
                  : 'bg-ochre';
          const title = `${snap.time}｜占用 ${st.occupied}/${seats}${
            st.queue > 0 ? `｜排队 ${st.queue}` : ''
          }${ratio === 1 ? '｜满座' : ''}`;
          return (
            <div
              key={snap.minute}
              title={title}
              className={`h-6 w-2.5 shrink-0 rounded-sm ${bg} ${
                ratio === 1 ? 'ring-1 ring-ochre/60' : ''
              } relative`}
            >
              {st.queue > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-500" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SimResultView({ result }: { result: SimulationResult }) {
  const totalSeats = result.benchResults.reduce((s, b) => s + b.seats, 0);
  const avgUtil =
    result.durationMinutes > 0
      ? Math.round(
          (result.benchResults.reduce((s, b) => s + b.avgUtilization * b.seats, 0) /
            (totalSeats || 1)) *
            100,
        )
      : 0;

  return (
    <div className="space-y-5">
      {/* 全局指标 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label="总到达人数" value={result.totalArrivals} tone="brown" />
        <StatCard
          icon={UserCheck}
          label="获得服务"
          value={result.totalServed}
          tone="moss"
          hint={`平均利用率 ${avgUtil}%`}
        />
        <StatCard
          icon={TrendingUp}
          label="占用峰值"
          value={result.peakOccupancy}
          hint={`全部座位共 ${totalSeats}`}
          tone="blue"
        />
        <StatCard
          icon={ListOrdered}
          label="排队峰值"
          value={result.peakQueue}
          hint={`满座累计 ${result.totalFullMinutes} 分钟`}
          tone="ochre"
        />
        <StatCard
          icon={UserX}
          label="流失人数"
          value={result.totalLost}
          hint="满座且无处转投"
          tone="red"
        />
        <StatCard
          icon={TimerReset}
          label="结束清队"
          value={result.queueCleared}
          hint="结束时刻排队清空（未获服务）"
          tone="ochre"
        />
        <StatCard
          icon={Clock}
          label="仿真时长"
          value={`${result.durationMinutes} 分钟`}
          hint={`${result.config.startTime} – ${result.config.endTime}`}
          tone="brown"
        />
        <StatCard
          icon={Users}
          label="参与长椅"
          value={result.benchResults.length}
          tone="moss"
        />
      </div>

      {/* 分钟级时间线 */}
      <div className="paper-texture rounded-xl shadow-paper p-5">
        <h4 className="font-serif text-base font-semibold text-deep-brown mb-1">
          逐分钟占用时间线
        </h4>
        <p className="text-xs text-ink-light mb-4">
          浅色 = 低占用，绿色 = 中高占用，橙色 = 满座；
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mx-1 align-middle" />
          表示该分钟有人排队。悬停可查看明细。
        </p>
        <div className="space-y-3">
          <TimelineRow
            result={result}
            benchId={null}
            label="全部合计"
            seats={totalSeats}
          />
          <div className="border-t border-deep-brown/10 pt-3 space-y-3">
            {result.benchResults.map((b) => (
              <TimelineRow
                key={b.benchId}
                result={result}
                benchId={b.benchId}
                label={b.name}
                seats={b.seats}
              />
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-ink-light">
          <span>{result.snapshots[0]?.time}</span>
          <div className="flex-1 h-px bg-deep-brown/10" />
          <span>{result.snapshots[result.snapshots.length - 1]?.time}</span>
        </div>
      </div>

      {/* 单椅明细表 */}
      <div className="paper-texture rounded-xl shadow-paper p-5 overflow-x-auto">
        <h4 className="font-serif text-base font-semibold text-deep-brown mb-3">
          各长椅明细
        </h4>
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="text-left text-xs text-ink-light border-b border-deep-brown/10">
              <th className="py-2 pr-3 font-medium">长椅</th>
              <th className="py-2 px-3 font-medium text-right">座位</th>
              <th className="py-2 px-3 font-medium text-right">到达</th>
              <th className="py-2 px-3 font-medium text-right">入座</th>
              <th className="py-2 px-3 font-medium text-right">排队入座</th>
              <th className="py-2 px-3 font-medium text-right">转入/转出</th>
              <th className="py-2 px-3 font-medium text-right">占用峰</th>
              <th className="py-2 px-3 font-medium text-right">排队峰</th>
              <th className="py-2 px-3 font-medium text-right">满座分钟</th>
              <th className="py-2 px-3 font-medium text-right">利用率</th>
              <th className="py-2 pl-3 font-medium text-right text-red-500">流失</th>
            </tr>
          </thead>
          <tbody>
            {result.benchResults.map((b) => (
              <tr
                key={b.benchId}
                className="border-b border-deep-brown/5 last:border-0 hover:bg-moss-green/5"
              >
                <td className="py-2 pr-3 text-deep-brown font-medium">{b.name}</td>
                <td className="py-2 px-3 text-right">{b.seats}</td>
                <td className="py-2 px-3 text-right">{b.totalArrivals}</td>
                <td className="py-2 px-3 text-right">{b.seatedDirect}</td>
                <td className="py-2 px-3 text-right">{b.seatedAfterWait}</td>
                <td className="py-2 px-3 text-right text-ink-light">
                  +{b.redirectedIn} / -{b.redirectedOut}
                </td>
                <td className="py-2 px-3 text-right">{b.peakOccupancy}</td>
                <td className="py-2 px-3 text-right">{b.peakQueue}</td>
                <td className="py-2 px-3 text-right">{b.fullMinutes}</td>
                <td className="py-2 px-3 text-right">{Math.round(b.avgUtilization * 100)}%</td>
                <td className="py-2 pl-3 text-right font-medium text-red-500">{b.lost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
