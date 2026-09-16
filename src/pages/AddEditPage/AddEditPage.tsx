import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  CloudSun,
} from 'lucide-react';
import { useBenchStore } from '@/store/useBenchStore';
import {
  MATERIAL_LABELS,
  ORIENTATION_LABELS,
  SHADE_LABELS,
  NOISE_LABELS,
  STAY_DURATION_LABELS,
  TIME_PERIOD_LABELS,
  DEFAULT_BENCH_CAPACITY,
} from '@/types';
import type {
  MaterialType,
  OrientationType,
  ShadeLevelType,
  NoiseLevelType,
  StayDurationType,
  TimePeriodType,
  BenchExperience,
} from '@/types';
import Rating from '@/components/Rating/Rating';
import { generateId } from '@/utils/comfort';

export default function AddEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { getBenchById, addBench, updateBench, initialize, initialized, addExperience, updateExperience, deleteExperience } = useBenchStore();
  const existingBench = id ? getBenchById(id) : undefined;

  const [formData, setFormData] = useState<{
    name: string;
    location: string;
    lat: number;
    lng: number;
    material: MaterialType;
    orientation: OrientationType;
    hasBackrest: boolean;
    shadeLevel: ShadeLevelType;
    noiseLevel: NoiseLevelType;
    stayDuration: StayDurationType;
    rating: number;
    review: string;
    seats: number | '';
    arrivalsPerHour: number | '';
    avgStayMinutes: number | '';
    maxQueue: number | '';
  }>({
    name: '',
    location: '',
    lat: 31.23,
    lng: 121.47,
    material: 'wood',
    orientation: 'south',
    hasBackrest: true,
    shadeLevel: 'partial',
    noiseLevel: 'moderate',
    stayDuration: 'medium',
    rating: 3,
    review: '',
    seats: DEFAULT_BENCH_CAPACITY.seats,
    arrivalsPerHour: DEFAULT_BENCH_CAPACITY.arrivalsPerHour,
    avgStayMinutes: DEFAULT_BENCH_CAPACITY.avgStayMinutes,
    maxQueue: DEFAULT_BENCH_CAPACITY.maxQueue,
  });

  const [experiences, setExperiences] = useState<BenchExperience[]>([]);
  const [capacityErrors, setCapacityErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialized, initialize]);

  useEffect(() => {
    if (isEdit && existingBench && initialized) {
      setFormData({
        name: existingBench.name,
        location: existingBench.location,
        lat: existingBench.lat,
        lng: existingBench.lng,
        material: existingBench.material,
        orientation: existingBench.orientation,
        hasBackrest: existingBench.hasBackrest,
        shadeLevel: existingBench.shadeLevel,
        noiseLevel: existingBench.noiseLevel,
        stayDuration: existingBench.stayDuration,
        rating: existingBench.rating,
        review: existingBench.review,
        // 旧档案缺字段时 store 已补默认登记值
        seats: existingBench.seats,
        arrivalsPerHour: existingBench.arrivalsPerHour,
        avgStayMinutes: existingBench.avgStayMinutes,
        maxQueue: existingBench.maxQueue,
      });
      setExperiences(existingBench.experiences || []);
    }
  }, [isEdit, existingBench, initialized]);

  const handleChange = (field: string, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /** 客流承载参数：按文本录入，允许临时为空，提交时统一校验 */
  const handleCapacityChange = (
    field: 'seats' | 'arrivalsPerHour' | 'avgStayMinutes' | 'maxQueue',
    raw: string,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: raw === '' ? '' : Number(raw) }));
    setCapacityErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateCapacity = (): boolean => {
    const errors: Record<string, string> = {};
    const { seats, arrivalsPerHour, avgStayMinutes, maxQueue } = formData;
    if (typeof seats !== 'number' || !Number.isInteger(seats) || seats <= 0) {
      errors.seats = '座位数必须为正整数，不能为零';
    }
    if (typeof arrivalsPerHour !== 'number' || arrivalsPerHour < 0) {
      errors.arrivalsPerHour = '每小时到达人数不能为负';
    }
    if (typeof avgStayMinutes !== 'number' || avgStayMinutes <= 0) {
      errors.avgStayMinutes = '平均停留分钟必须为正数';
    }
    if (typeof maxQueue !== 'number' || !Number.isInteger(maxQueue) || maxQueue < 0) {
      errors.maxQueue = '等候上限必须为非负整数';
    }
    setCapacityErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddExperience = () => {
    const newExp: BenchExperience = {
      id: generateId(),
      benchId: id || 'temp',
      timePeriod: 'morning',
      notes: '',
      rating: 3,
    };
    setExperiences([...experiences, newExp]);
  };

  const handleUpdateExperience = (expId: string, field: string, value: string | number) => {
    setExperiences(
      experiences.map((exp) =>
        exp.id === expId ? { ...exp, [field]: value } : exp
      )
    );
  };

  const handleDeleteExperience = (expId: string) => {
    setExperiences(experiences.filter((exp) => exp.id !== expId));
    if (isEdit && id) {
      deleteExperience(id, expId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('请输入长椅名称');
      return;
    }
    if (!formData.location.trim()) {
      alert('请输入位置描述');
      return;
    }
    if (!validateCapacity()) {
      return;
    }

    // 承载参数此时已校验为数字
    const capacity = {
      seats: formData.seats as number,
      arrivalsPerHour: formData.arrivalsPerHour as number,
      avgStayMinutes: formData.avgStayMinutes as number,
      maxQueue: formData.maxQueue as number,
    };

    if (isEdit && id) {
      updateBench(id, { ...formData, ...capacity });
      experiences.forEach((exp) => {
        const existingExp = existingBench?.experiences.find((e) => e.id === exp.id);
        if (existingExp) {
          updateExperience(id, exp.id, exp);
        } else {
          addExperience(id, exp);
        }
      });
    } else {
      addBench({
        ...formData,
        ...capacity,
      });
    }

    navigate(-1);
  };

  const timePeriodIcons: Record<TimePeriodType, typeof Sunrise> = {
    morning: Sunrise,
    noon: Sun,
    afternoon: CloudSun,
    evening: Sunset,
    night: Moon,
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-ink-light hover:text-deep-brown mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">返回</span>
      </button>

      <div className="max-w-3xl mx-auto">
        <h1 className="font-serif text-2xl font-bold text-deep-brown mb-6">
          {isEdit ? '编辑长椅档案' : '添加长椅档案'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="paper-texture rounded-xl shadow-paper p-6 fade-in opacity-0 stagger-1">
            <h2 className="font-serif text-lg font-semibold text-deep-brown mb-4">
              基本信息
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  长椅名称 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="给这张长椅起个名字"
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown placeholder:text-ink-light/60 focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  位置描述 *
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  placeholder="例如：人民公园东门北侧"
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown placeholder:text-ink-light/60 focus:bg-white transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-deep-brown mb-1.5">
                    纬度
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.lat}
                    onChange={(e) => handleChange('lat', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-deep-brown mb-1.5">
                    经度
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.lng}
                    onChange={(e) => handleChange('lng', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown focus:bg-white transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="paper-texture rounded-xl shadow-paper p-6 fade-in opacity-0 stagger-2">
            <h2 className="font-serif text-lg font-semibold text-deep-brown mb-4">
              特征属性
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  材质
                </label>
                <select
                  value={formData.material}
                  onChange={(e) => handleChange('material', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown focus:bg-white cursor-pointer"
                >
                  {Object.entries(MATERIAL_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  朝向
                </label>
                <select
                  value={formData.orientation}
                  onChange={(e) => handleChange('orientation', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown focus:bg-white cursor-pointer"
                >
                  {Object.entries(ORIENTATION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  遮阴情况
                </label>
                <select
                  value={formData.shadeLevel}
                  onChange={(e) => handleChange('shadeLevel', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown focus:bg-white cursor-pointer"
                >
                  {Object.entries(SHADE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  噪音等级
                </label>
                <select
                  value={formData.noiseLevel}
                  onChange={(e) => handleChange('noiseLevel', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown focus:bg-white cursor-pointer"
                >
                  {Object.entries(NOISE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  适合停留时长
                </label>
                <select
                  value={formData.stayDuration}
                  onChange={(e) => handleChange('stayDuration', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown focus:bg-white cursor-pointer"
                >
                  {Object.entries(STAY_DURATION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  是否有靠背
                </label>
                <div className="flex items-center gap-4 h-[42px]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="hasBackrest"
                      checked={formData.hasBackrest}
                      onChange={() => handleChange('hasBackrest', true)}
                      className="text-moss-green focus:ring-moss-green"
                    />
                    <span className="text-sm text-deep-brown">有</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="hasBackrest"
                      checked={!formData.hasBackrest}
                      onChange={() => handleChange('hasBackrest', false)}
                      className="text-moss-green focus:ring-moss-green"
                    />
                    <span className="text-sm text-deep-brown">无</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="paper-texture rounded-xl shadow-paper p-6 fade-in opacity-0 stagger-3">
            <h2 className="font-serif text-lg font-semibold text-deep-brown mb-1">
              客流承载参数
            </h2>
            <p className="text-xs text-ink-light mb-4">
              登记到长椅档案，作为客流仿真的默认参数；仿真页仍可临时调整，不影响档案。
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  座位数
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={formData.seats}
                  onChange={(e) => handleCapacityChange('seats', e.target.value)}
                  className={`w-full px-4 py-2.5 bg-white/50 border rounded-lg text-deep-brown focus:bg-white transition-colors ${
                    capacityErrors.seats ? 'border-red-400' : 'border-deep-brown/10'
                  }`}
                />
                {capacityErrors.seats && (
                  <p className="text-xs text-red-500 mt-1">{capacityErrors.seats}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  每小时到达人数
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.arrivalsPerHour}
                  onChange={(e) => handleCapacityChange('arrivalsPerHour', e.target.value)}
                  className={`w-full px-4 py-2.5 bg-white/50 border rounded-lg text-deep-brown focus:bg-white transition-colors ${
                    capacityErrors.arrivalsPerHour ? 'border-red-400' : 'border-deep-brown/10'
                  }`}
                />
                {capacityErrors.arrivalsPerHour && (
                  <p className="text-xs text-red-500 mt-1">{capacityErrors.arrivalsPerHour}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  平均停留分钟
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={formData.avgStayMinutes}
                  onChange={(e) => handleCapacityChange('avgStayMinutes', e.target.value)}
                  className={`w-full px-4 py-2.5 bg-white/50 border rounded-lg text-deep-brown focus:bg-white transition-colors ${
                    capacityErrors.avgStayMinutes ? 'border-red-400' : 'border-deep-brown/10'
                  }`}
                />
                {capacityErrors.avgStayMinutes && (
                  <p className="text-xs text-red-500 mt-1">{capacityErrors.avgStayMinutes}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  等候上限（人）
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.maxQueue}
                  onChange={(e) => handleCapacityChange('maxQueue', e.target.value)}
                  className={`w-full px-4 py-2.5 bg-white/50 border rounded-lg text-deep-brown focus:bg-white transition-colors ${
                    capacityErrors.maxQueue ? 'border-red-400' : 'border-deep-brown/10'
                  }`}
                />
                {capacityErrors.maxQueue && (
                  <p className="text-xs text-red-500 mt-1">{capacityErrors.maxQueue}</p>
                )}
              </div>
            </div>
          </div>

          <div className="paper-texture rounded-xl shadow-paper p-6 fade-in opacity-0 stagger-4">
            <h2 className="font-serif text-lg font-semibold text-deep-brown mb-4">
              个人评价
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  综合评分
                </label>
                <Rating
                  value={formData.rating}
                  onChange={(value) => handleChange('rating', value)}
                  size="lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  评价文字
                </label>
                <textarea
                  value={formData.review}
                  onChange={(e) => handleChange('review', e.target.value)}
                  placeholder="写下你对这张长椅的感受..."
                  rows={4}
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown placeholder:text-ink-light/60 focus:bg-white transition-colors resize-none"
                />
              </div>
            </div>
          </div>

          <div className="paper-texture rounded-xl shadow-paper p-6 fade-in opacity-0 stagger-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg font-semibold text-deep-brown">
                分时段体验
              </h2>
              <button
                type="button"
                onClick={handleAddExperience}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-moss-green hover:bg-moss-green/10 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加时段
              </button>
            </div>

            {experiences.length > 0 ? (
              <div className="space-y-4">
                {experiences.map((exp) => {
                  const TimeIcon = timePeriodIcons[exp.timePeriod];
                  return (
                    <div
                      key={exp.id}
                      className="p-4 bg-warm-cream/50 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <TimeIcon className="w-5 h-5 text-ochre" />
                          <select
                            value={exp.timePeriod}
                            onChange={(e) =>
                              handleUpdateExperience(exp.id, 'timePeriod', e.target.value)
                            }
                            className="px-2 py-1 text-sm bg-white border border-deep-brown/10 rounded-md text-deep-brown cursor-pointer"
                          >
                            {Object.entries(TIME_PERIOD_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteExperience(exp.id)}
                          className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mb-3">
                        <label className="text-xs text-ink-light mb-1 block">
                          时段评分
                        </label>
                        <Rating
                          value={exp.rating}
                          onChange={(value) =>
                            handleUpdateExperience(exp.id, 'rating', value)
                          }
                          size="sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-ink-light mb-1 block">
                          体验备注
                        </label>
                        <textarea
                          value={exp.notes}
                          onChange={(e) =>
                            handleUpdateExperience(exp.id, 'notes', e.target.value)
                          }
                          placeholder="记录这个时段的体验..."
                          rows={2}
                          className="w-full px-3 py-2 text-sm bg-white/60 border border-deep-brown/10 rounded-md text-deep-brown placeholder:text-ink-light/60 focus:bg-white resize-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-ink-light">
                  还没有添加时段体验
                </p>
                <p className="text-xs text-ink-light/60 mt-1">
                  可以记录早晨、中午、下午等不同时段的感受
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-4 pb-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 px-6 py-3 bg-warm-beige text-deep-brown rounded-xl font-medium hover:bg-warm-beige/80 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-moss-green text-white rounded-xl font-medium hover:bg-moss-light transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isEdit ? '保存修改' : '添加档案'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
