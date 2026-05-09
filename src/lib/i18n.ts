import { create } from 'zustand';

export type Lang = 'en' | 'ru';

const dict = {
  en: {
    appTitle: 'M/V Mohican — Cargo Stowage Planner',
    statusOffline: 'offline · Windows-ready',
    menuNew: 'New',
    menuOpen: 'Open…',
    menuSave: 'Save JSON',
    menuExportPdf: 'Export PDF',
    confirmNewPlan: 'Start a new plan? Unsaved changes will be lost.',
    invalidPlanFile: 'Invalid plan file.',

    voyage: 'Voyage',
    voyageRef: 'Voyage / reference',
    voyagePlaceholder: 'e.g. 24 / Hamburg → St-Petersburg',
    notes: 'Notes',

    conditions: 'Conditions',
    seaWaterDensity: 'Sea water density (t/m³)',
    atSea: 'At sea',
    inHarbour: 'In harbour',

    shipSummary: 'Ship summary',
    cargoTotal: 'Cargo total',
    totalDisplacement: 'Total displacement',
    meanDraft: 'Mean draft',
    trim: 'Trim (− = bow / + = stern)',
    draftFpAp: 'Draft FP / AP',
    lcg: 'LCG',
    vcg: 'VCG',
    pcs: 'pcs',

    strengthCheck: 'Strength check',
    shearForce: 'Shear force (SF)',
    bendingMoment: 'Bending moment (BM)',
    holds: 'Holds',
    maxTankTop: 'Max tank-top',
    limit: 'limit',

    cargoParcels: 'Cargo parcels',
    noParcelsYet: 'No parcels yet. Use the form below to add one.',
    parcelDimsLine: (l: number, b: number, h: number, w: number, port: string) =>
      `${l}×${b}×${h} m · ${w} t · port ${port || '—'}`,
    parcelStackLine: (stack: string, rot: string, tol: number) =>
      `Stack: ${stack} · Rot: ${rot} · Tol: ${tol}%`,
    stackNo: 'no',
    yes: 'Y',
    no: 'N',
    del: 'Del',
    confirmDeleteParcel: (name: string) =>
      `Delete parcel «${name}» together with all its placed pieces in the holds?`,
    qtyTooltip: (remaining: number) =>
      `Total parcel size; ${remaining} remaining unplaced`,

    addCargoParcel: 'Add cargo parcel',
    name: 'Name',
    namePlaceholder: 'Pipe bundle 12 m',
    lengthM: 'Length, m',
    breadthM: 'Breadth, m',
    weightPerPiece: 'Weight per piece, t',
    quantityPcs: 'Quantity, pcs',
    heightM: 'Height, m',
    tolerancePct: 'Dimensional tolerance, %',
    stackPolicy: 'Stack policy',
    singleTier: 'Single tier only',
    stackable: 'Stackable',
    maxStackTiers: 'Max stacking tiers',
    allowRotation: 'Allow 90° rotation around vertical axis',
    dischargePort: 'Discharge port',
    shipperBl: 'Shipper / BL',
    addParcel: 'Add parcel',
    reset: 'Reset',
    enterName: 'Please enter a name for the parcel.',
    nonPositive: 'Length, breadth, height and weight must be positive.',
    effectiveDims: 'Effective dims used by the packer',

    autoLayout: 'Auto-layout',
    packHoldN: (n: number) => `Pack hold ${n}`,
    packAllHolds: 'Pack all holds',
    clearHoldN: (n: number) => `Clear hold ${n}`,
    confirmClearHold: (n: number) =>
      `Clear hold ${n}? All cargo currently placed in this hold will be removed.`,
    autoDistribute: 'Auto-distribute parcel',
    selectedParcel: 'Selected parcel',
    useFirstParcel: '(use the first parcel)',
    byQuantity: 'By quantity',
    byMeanDraft: 'By mean draft',
    bySternTrim: 'By stern trim',
    targetMeanDraft: (max: number) => `Target mean draft, m (≤ ${max})`,
    targetTrim: 'Target trim, m (positive = stern down)',
    calculating: 'Calculating…',
    distributeAndPack: 'Distribute & pack',
    addParcelFirst: 'Add a parcel first.',

    distributedParcel: (
      name: string,
      h1: number, h2: number, h3: number, h4: number,
      total: number, trim: number, draft: number,
    ) =>
      `Distributed «${name}»: H1=${h1} H2=${h2} H3=${h3} H4=${h4} ` +
      `(total ${total}, est. trim ${trim.toFixed(2)} m, mean draft ${draft.toFixed(2)} m)`,
    feasibilityWarn: '  ⚠ exceeds SF/BM limits!',
    holdResult: (n: number, placed: number, unplaced: number) =>
      `Hold ${n}: placed ${placed} pcs (${unplaced} not fitted across all parcels).`,
    allHoldsResult: (total: number) =>
      `All holds: placed ${total} pcs (templates unchanged).`,

    topView: 'TOP VIEW (looking down)',
    sideView: 'SIDE VIEW (looking from port; aft is on the left)',
    colourBy: 'Colour by:',
    cmTemplate: 'Parcel',
    cmPort: 'Port',
    cmShipper: 'Shipper',
    cmWeight: 'Weight',
    cmStack: 'Stack',
    legendFreeSpace: 'free space (with dimensions)',
    legendDragHint: 'Drag pieces to move · Double-click to remove',

    holdForward: 'forward',
    holdAft: 'aft',
  },
  ru: {
    appTitle: 'М/В Мохикан — Планировщик грузовой раскладки',
    statusOffline: 'офлайн · Windows',
    menuNew: 'Новый',
    menuOpen: 'Открыть…',
    menuSave: 'Сохранить JSON',
    menuExportPdf: 'Экспорт в PDF',
    confirmNewPlan: 'Начать новый план? Несохранённые изменения будут утеряны.',
    invalidPlanFile: 'Файл плана повреждён или имеет неверный формат.',

    voyage: 'Рейс',
    voyageRef: 'Рейс / референс',
    voyagePlaceholder: 'напр. 24 / Гамбург → Санкт-Петербург',
    notes: 'Примечания',

    conditions: 'Условия',
    seaWaterDensity: 'Плотность забортной воды (т/м³)',
    atSea: 'В море',
    inHarbour: 'В порту',

    shipSummary: 'Сводка по судну',
    cargoTotal: 'Всего груза',
    totalDisplacement: 'Водоизмещение',
    meanDraft: 'Средняя осадка',
    trim: 'Дифферент (− = на нос / + = на корму)',
    draftFpAp: 'Осадка FP / AP',
    lcg: 'LCG',
    vcg: 'VCG',
    pcs: 'шт.',

    strengthCheck: 'Проверка прочности',
    shearForce: 'Срезывающая сила (SF)',
    bendingMoment: 'Изгибающий момент (BM)',
    holds: 'Трюмы',
    maxTankTop: 'Макс. нагрузка на II дно',
    limit: 'лимит',

    cargoParcels: 'Партии груза',
    noParcelsYet: 'Партий пока нет. Добавьте партию формой ниже.',
    parcelDimsLine: (l: number, b: number, h: number, w: number, port: string) =>
      `${l}×${b}×${h} м · ${w} т · порт ${port || '—'}`,
    parcelStackLine: (stack: string, rot: string, tol: number) =>
      `Штаб: ${stack} · Поворот: ${rot} · Доп: ${tol}%`,
    stackNo: 'нет',
    yes: 'Да',
    no: 'Нет',
    del: 'Уд',
    confirmDeleteParcel: (name: string) =>
      `Удалить партию «${name}» вместе со всеми её размещёнными местами в трюмах?`,
    qtyTooltip: (remaining: number) =>
      `Размер партии; ${remaining} ещё не размещено`,

    addCargoParcel: 'Добавить партию груза',
    name: 'Наименование',
    namePlaceholder: 'Пакет труб 12 м',
    lengthM: 'Длина, м',
    breadthM: 'Ширина, м',
    weightPerPiece: 'Вес одного места, т',
    quantityPcs: 'Количество, шт',
    heightM: 'Высота, м',
    tolerancePct: 'Допуск размеров, %',
    stackPolicy: 'Штабелирование',
    singleTier: 'Только один ярус',
    stackable: 'Можно в несколько ярусов',
    maxStackTiers: 'Макс. число ярусов',
    allowRotation: 'Можно поворачивать на 90° вокруг вертикальной оси',
    dischargePort: 'Порт выгрузки',
    shipperBl: 'Отправитель / BL',
    addParcel: 'Добавить партию',
    reset: 'Сброс',
    enterName: 'Введите название груза.',
    nonPositive: 'Длина, ширина, высота и вес должны быть положительными.',
    effectiveDims: 'Эффективные размеры с допуском',

    autoLayout: 'Авто-раскладка',
    packHoldN: (n: number) => `Раскладка трюм ${n}`,
    packAllHolds: 'Раскладка всех трюмов',
    clearHoldN: (n: number) => `Очистить трюм ${n}`,
    confirmClearHold: (n: number) =>
      `Очистить трюм ${n}? Все размещённые в нём грузовые места будут удалены.`,
    autoDistribute: 'Авто-распределение партии',
    selectedParcel: 'Выбранная партия',
    useFirstParcel: '(используется первая партия)',
    byQuantity: 'По количеству',
    byMeanDraft: 'По средней осадке',
    bySternTrim: 'По дифференту на корму',
    targetMeanDraft: (max: number) => `Целевая средняя осадка, м (≤ ${max})`,
    targetTrim: 'Целевой дифферент, м (плюс = на корму)',
    calculating: 'Считаю…',
    distributeAndPack: 'Распределить и разложить',
    addParcelFirst: 'Сначала добавьте партию груза.',

    distributedParcel: (
      name: string,
      h1: number, h2: number, h3: number, h4: number,
      total: number, trim: number, draft: number,
    ) =>
      `Распределена «${name}»: H1=${h1} H2=${h2} H3=${h3} H4=${h4} ` +
      `(всего ${total}, дифферент ≈ ${trim.toFixed(2)} м, ср. осадка ${draft.toFixed(2)} м)`,
    feasibilityWarn: '  ⚠ выходит за лимиты SF/BM!',
    holdResult: (n: number, placed: number, unplaced: number) =>
      `Трюм ${n}: размещено ${placed} мест (${unplaced} мест не поместились).`,
    allHoldsResult: (total: number) =>
      `Все трюмы: размещено ${total} мест.`,

    topView: 'ВИД СВЕРХУ (смотрим вниз)',
    sideView: 'ВИД СБОКУ (со стороны левого борта; корма слева)',
    colourBy: 'Цвет по:',
    cmTemplate: 'Партии',
    cmPort: 'Порту',
    cmShipper: 'Отправителю',
    cmWeight: 'Весу',
    cmStack: 'Штабелю',
    legendFreeSpace: 'свободное место (с размерами)',
    legendDragHint: 'Перетаскивайте для перемещения · Двойной клик — удалить',

    holdForward: 'нос',
    holdAft: 'корма',
  },
} as const;

type Dict = typeof dict.en;
export type TKey = keyof Dict;

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

function detectInitial(): Lang {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('mohican.lang');
    if (stored === 'en' || stored === 'ru') return stored;
  }
  if (typeof navigator !== 'undefined') {
    const nav = (navigator.language || '').toLowerCase();
    if (nav.startsWith('ru')) return 'ru';
  }
  return 'en';
}

export const useLang = create<LangState>((set) => ({
  lang: detectInitial(),
  setLang: (l) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('mohican.lang', l);
    set({ lang: l });
  },
}));

export function useT() {
  const lang = useLang((s) => s.lang);
  const d = dict[lang];
  return d;
}

export function tFor(lang: Lang) {
  return dict[lang];
}
