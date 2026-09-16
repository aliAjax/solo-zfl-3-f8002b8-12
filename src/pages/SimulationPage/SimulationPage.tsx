import { useEffect, useMemo, useState } from 'react';
import { Play, Save, RotateCcw, Dices, GitCompare, ChevronDown, ChevronUp } from 'lucide-react';
import { useBenchStore } from '@/store/useBenchStore';
import { useSimPlanStore } from '@/store/useSimPlanStore';
import { runSimulation } from '@/simulation/engine';
import type { SimulationConfig, SimulationResult, ValidationErrors } from '@/simulation/types';
import type { SavedPlan } from '@/utils/simStorage';
import SimConfigForm from './SimConfigForm';
import { defaultFormState, buildConfig, benchParamsFromArchive, type SimFormState } from './simForm';
import SimResultView from './SimResultView';
import PlanCompare from './PlanCompare';

export default function SimulationPage() {
  const { benches, initialize, initialized } = useBenchStore();
  const {
    plans,
    initialize: initPlans,
    initialized: plansInitialized,
    savePlan,
    deletePlan,
  } = useSimPlanStore();

  const [form, setForm] = useState<SimFormState | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [showCompare, setShowCompare] = useState(true);
  const [showConfig, setShowConfig] = useState(true);

  useEffect(() => {
    if (!initialized) initialize();
    if (!plansInitialized) initPlans();
  }, [initialized, initialize, plansInitialized, initPlans]);

  // 长椅列表就绪/变化后：新增长椅取档案登记默认值；已有的临时调整不被档案反向覆盖
  useEffect(() => {
    if (!initialized || benches.length === 0) return;
    setForm((prev) => {
      if (!prev) return defaultFormState(benches, { seed: 42 });
      const archiveDefaults = benchParamsFromArchive(benches);
      return {
        ...prev,
        seedText: prev.seedText.trim() === '' ? '42' : prev.seedText,
        benchParams: { ...archiveDefaults, ...prev.benchParams },
      };
    });
  }, [initialized, benches]);

  // 放弃临时调整，全部恢复为档案登记值（不影响全局时间与种子）
  const handleResetFromArchive = () => {
    if (!form) return;
    setForm({ ...form, benchParams: benchParamsFromArchive(benches) });
  };

  const handleRun = () => {
    if (!form) return;
    const effectiveForm =
      form.name.trim() === '' ? { ...form, name: `方案 ${plans.length + 1}` } : form;
    const { config, errors: parseErrors } = buildConfig(effectiveForm, benches);
    setErrors(parseErrors);
    if (Object.keys(parseErrors).length > 0) {
      setShowConfig(true);
      return;
    }
    // 确定性运行：相同 config（含种子）结果一致
    const simResult = runSimulation(config);
    setResult(simResult);
    setSaved(false);
    if (effectiveForm !== form) setForm(effectiveForm);
    setShowConfig(false);
  };

  const handleSave = () => {
    if (!result) return;
    savePlan(result);
    setSaved(true);
  };

  const handleLoadPlan = (plan: SavedPlan) => {
    const cfg: SimulationConfig = plan.result.config;
    // 以当前档案长椅为底合并，保证档案中新增的长椅也有默认参数
    const base = defaultFormState(benches, { seed: cfg.seed });
    setForm({
      name: cfg.name,
      startTime: cfg.startTime,
      endTime: cfg.endTime,
      seedText: String(cfg.seed),
      benchParams: {
        ...base.benchParams,
        ...Object.fromEntries(
          cfg.benches.map((b) => [
            b.benchId,
            {
              seats: String(b.seats),
              arrivalsPerHour: String(b.arrivalsPerHour),
              avgStayMinutes: String(b.avgStayMinutes),
              maxQueue: String(b.maxQueue),
            },
          ]),
        ),
      },
    });
    setResult(plan.result);
    setSaved(true);
    setErrors({});
    setShowConfig(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRandomSeed = () => {
    if (!form) return;
    // 仅用于生成便于尝试的种子；运行本身仍完全由种子决定
    const seed = Math.floor(Math.random() * 1_000_000);
    setForm({ ...form, seedText: String(seed) });
  };

  const resultConfig = useMemo(() => result?.config, [result]);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-deep-brown mb-1">
            客流承载仿真
          </h2>
          <p className="text-ink-light text-sm">
            按分钟推进的到达—入座—排队—转投模型；同参数同种子，结果可复现
          </p>
        </div>
        {form && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleRandomSeed}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-ink-light hover:bg-deep-brown/5 hover:text-deep-brown transition-colors"
              title="随机换一个种子"
            >
              <Dices className="w-4 h-4" />
              换种子
            </button>
            <button
              onClick={handleRun}
              className="flex items-center gap-1.5 px-4 py-2 bg-moss-green text-white rounded-lg font-medium text-sm hover:bg-moss-light transition-colors shadow-md"
            >
              <Play className="w-4 h-4" />
              运行仿真
            </button>
          </div>
        )}
      </div>

      {/* 参数区 */}
      {form && (
        <section className="mb-6">
          <button
            onClick={() => setShowConfig((v) => !v)}
            className="w-full flex items-center justify-between paper-texture rounded-t-xl px-5 py-3 border-b border-deep-brown/10"
          >
            <span className="font-serif text-base font-semibold text-deep-brown">
              仿真参数
            </span>
            {showConfig ? <ChevronUp className="w-4 h-4 text-ink-light" /> : <ChevronDown className="w-4 h-4 text-ink-light" />}
          </button>
          {showConfig && (
            <div className="paper-texture rounded-b-xl shadow-paper p-5">
              <SimConfigForm
                benches={benches}
                form={form}
                onChange={setForm}
                errors={errors}
                onResetArchive={handleResetFromArchive}
              />
              {Object.keys(errors).length > 0 && (
                <p className="mt-4 text-sm text-red-500">
                  存在 {Object.keys(errors).length} 处参数问题，请修正后再运行。
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* 结果区 */}
      {result && resultConfig && (
        <section className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-serif text-xl font-semibold text-deep-brown">
                {resultConfig.name}
              </h3>
              <p className="text-xs text-ink-light">
                {resultConfig.startTime} – {resultConfig.endTime} · 时长{' '}
                {result.durationMinutes} 分钟 · 种子 {resultConfig.seed}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setResult(null)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-ink-light hover:bg-deep-brown/5 hover:text-deep-brown transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                清除结果
              </button>
              <button
                onClick={handleSave}
                disabled={saved}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-md ${
                  saved
                    ? 'bg-moss-green/30 text-white cursor-default'
                    : 'bg-ochre text-white hover:bg-ochre-light'
                }`}
              >
                <Save className="w-4 h-4" />
                {saved ? '已保存到方案库' : '保存方案'}
              </button>
            </div>
          </div>
          <SimResultView result={result} />
        </section>
      )}

      {/* 方案对比 */}
      <section>
        <button
          onClick={() => setShowCompare((v) => !v)}
          className="w-full flex items-center justify-between mb-3"
        >
          <h3 className="flex items-center gap-2 font-serif text-lg font-semibold text-deep-brown">
            <GitCompare className="w-5 h-5 text-moss-green" />
            已存方案（{plans.length}）
          </h3>
          {showCompare ? <ChevronUp className="w-4 h-4 text-ink-light" /> : <ChevronDown className="w-4 h-4 text-ink-light" />}
        </button>
        {showCompare && (
          <PlanCompare plans={plans} onDelete={deletePlan} onLoad={handleLoadPlan} />
        )}
      </section>
    </div>
  );
}
