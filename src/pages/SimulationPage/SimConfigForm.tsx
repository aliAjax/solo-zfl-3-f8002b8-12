import { AlertCircle } from 'lucide-react';
import type { Bench } from '@/types';
import type { ValidationErrors } from '@/simulation/types';
import type { SimFormState } from './simForm';

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
      <AlertCircle className="w-3 h-3 shrink-0" />
      {message}
    </p>
  );
}

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-deep-brown/15 bg-warm-cream text-sm text-deep-brown';
const numInputCls = `${inputCls} text-right`;

export default function SimConfigForm({
  benches,
  form,
  onChange,
  errors,
}: {
  benches: Bench[];
  form: SimFormState;
  onChange: (next: SimFormState) => void;
  errors: ValidationErrors;
}) {
  const setGlobal = (patch: Partial<SimFormState>) => onChange({ ...form, ...patch });
  const setBench = (benchId: string, patch: Partial<SimFormState['benchParams'][string]>) =>
    onChange({
      ...form,
      benchParams: {
        ...form.benchParams,
        [benchId]: { ...form.benchParams[benchId], ...patch },
      },
    });

  return (
    <div className="space-y-5">
      {/* 全局参数 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-deep-brown">方案名称</span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setGlobal({ name: e.target.value })}
            placeholder="例如：周末上午方案"
            className={`${inputCls} mt-1 ${errors.name ? 'border-red-400' : ''}`}
          />
          <FieldError message={errors.name} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-deep-brown">开始时间</span>
          <input
            type="time"
            value={form.startTime}
            onChange={(e) => setGlobal({ startTime: e.target.value })}
            className={`${inputCls} mt-1 ${errors.startTime ? 'border-red-400' : ''}`}
          />
          <FieldError message={errors.startTime} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-deep-brown">结束时间</span>
          <input
            type="time"
            value={form.endTime}
            onChange={(e) => setGlobal({ endTime: e.target.value })}
            className={`${inputCls} mt-1 ${errors.endTime ? 'border-red-400' : ''}`}
          />
          <FieldError message={errors.endTime} />
        </label>
      </div>

      <label className="block max-w-xs">
        <span className="text-sm font-medium text-deep-brown">随机种子（整数）</span>
        <input
          type="number"
          step="1"
          value={form.seedText}
          onChange={(e) => setGlobal({ seedText: e.target.value })}
          placeholder="例如 42"
          className={`${inputCls} mt-1 ${errors.seed ? 'border-red-400' : ''}`}
        />
        <FieldError message={errors.seed} />
        <span className="text-xs text-ink-light">相同参数与种子必然复现同一结果</span>
      </label>

      {/* 各长椅参数 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-serif text-base font-semibold text-deep-brown">
            长椅参数
          </h4>
          <span className="text-xs text-ink-light">
            到达按泊松抽样，停留按指数分布抽样（分钟）
          </span>
        </div>
        <div className="space-y-3">
          {benches.length === 0 && (
            <p className="text-sm text-red-500">
              档案中还没有长椅，请先到列表页添加长椅后再做仿真。
            </p>
          )}
          {errors.benches && <FieldError message={errors.benches} />}
          {benches.map((bench, i) => {
            const p = form.benchParams[bench.id];
            if (!p) return null;
            const prefix = `benches.${i}`;
            return (
              <div
                key={bench.id}
                className="rounded-xl border border-deep-brown/10 bg-warm-cream/60 p-4"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 mb-3">
                  <span className="font-medium text-deep-brown">{bench.name}</span>
                  <span className="text-xs text-ink-light">{bench.location}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <label className="block">
                    <span className="text-xs text-ink-light">座位数</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={p.seats}
                      onChange={(e) => setBench(bench.id, { seats: e.target.value })}
                      className={`${numInputCls} mt-1 ${errors[`${prefix}.seats`] ? 'border-red-400' : ''}`}
                    />
                    <FieldError message={errors[`${prefix}.seats`]} />
                  </label>
                  <label className="block">
                    <span className="text-xs text-ink-light">每小时到达人数</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={p.arrivalsPerHour}
                      onChange={(e) =>
                        setBench(bench.id, { arrivalsPerHour: e.target.value })
                      }
                      className={`${numInputCls} mt-1 ${
                        errors[`${prefix}.arrivalsPerHour`] ? 'border-red-400' : ''
                      }`}
                    />
                    <FieldError message={errors[`${prefix}.arrivalsPerHour`]} />
                  </label>
                  <label className="block">
                    <span className="text-xs text-ink-light">平均停留(分钟)</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={p.avgStayMinutes}
                      onChange={(e) =>
                        setBench(bench.id, { avgStayMinutes: e.target.value })
                      }
                      className={`${numInputCls} mt-1 ${
                        errors[`${prefix}.avgStayMinutes`] ? 'border-red-400' : ''
                      }`}
                    />
                    <FieldError message={errors[`${prefix}.avgStayMinutes`]} />
                  </label>
                  <label className="block">
                    <span className="text-xs text-ink-light">等候上限(人)</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={p.maxQueue}
                      onChange={(e) => setBench(bench.id, { maxQueue: e.target.value })}
                      className={`${numInputCls} mt-1 ${
                        errors[`${prefix}.maxQueue`] ? 'border-red-400' : ''
                      }`}
                    />
                    <FieldError message={errors[`${prefix}.maxQueue`]} />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
