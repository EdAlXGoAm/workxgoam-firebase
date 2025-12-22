import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CostCalculationService, CostItem, CostCalculation } from '../../services/cost-calculation.service';
import Chart from 'chart.js/auto';
import { IngredientService, Ingredient, IngredientHistory } from '../../services/ingredient.service';
import { Storage, ref, uploadString, getDownloadURL } from '@angular/fire/storage';

type RecipeQtyUnit = 'KG' | 'G' | 'L' | 'ML' | 'PZ';
type SelectedIngredientRow = { ingredientId: string; quantity: number; quantityUnit?: RecipeQtyUnit; portions?: number };

@Component({
  selector: 'app-calculadora',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calculadora.component.html',
  styles: []
})
export class CalculadoraComponent implements OnInit, AfterViewInit, OnDestroy {
  // Ingredientes
  ingredients: Ingredient[] = [];
  selectedIngredients: SelectedIngredientRow[] = [];
  /**
   * Estado UI (no persistido) para el autocomplete de ingredientes por fila.
   * Se mantiene separado de `selectedIngredients` para no romper el guardado en Firestore.
   */
  ingredientSearchText: string[] = [];
  ingredientDropdownOpen: boolean[] = [];
  activeIngredientDropdownIndex: number | null = null;
  private ingredientDropdownAnchorEl: HTMLElement | null = null;
  ingredientDropdownTop = 0;
  ingredientDropdownLeft = 0;
  ingredientDropdownWidth = 0;

  // Draft / cache local (para sobrevivir refresh)
  private readonly draftStorageKey = 'workxgoam:calculadora:draft:v1';
  private draftSaveTimer: any = null;
  private isRestoringDraft = false;
  private chartsReady = false;
  private ingredientsLoaded = false;
  private pendingRecalc = false;
  // ID del cálculo actualmente cargado (null si es nuevo)
  currentLoadedId: string | null = null;
  // Lista de cálculos guardados
  savedCalculations: CostCalculation[] = [];
  // Toggle para mostrar/ocultar el modal de cálculos guardados
  private _showSavedCalculations = false;
  get showSavedCalculations(): boolean { return this._showSavedCalculations; }
  set showSavedCalculations(value: boolean) {
    this._showSavedCalculations = value;
    // Bloquear/desbloquear scroll del body
    if (value) {
      document.body.style.overflow = 'hidden';
      this.startImageRotation();
    } else {
      document.body.style.overflow = '';
      this.stopImageRotation();
    }
  }
  /** Draft de edición de carpeta por receta (no persistido hasta presionar Enter) */
  folderDraftByCalcId: Record<string, string> = {};
  
  // Rotación de imágenes en el modal de cálculos guardados
  private calcImageIndexMap: Map<string, number> = new Map();
  private imageRotationTimer: any = null;
  
  // Propiedades para drag de la burbuja de cálculos guardados
  savedCalcBubbleTop = 50; // Posición vertical en porcentaje
  isSavedCalcBubbleDragging = false;
  private savedCalcBubbleDragStartY = 0;
  private savedCalcBubbleDragStartTop = 0;
  private savedCalcBubbleLastDragEndTime = 0;
  /** Estado de expandir/colapsar por carpeta (true = expanded) */
  folderExpandedByKey: Record<string, boolean> = {};
  // Costos
  costsWithoutProfit: CostItem[] = [];
  costsWithProfit: CostItem[] = [];

  // Labor - múltiples entradas con selección de tarifa
  laborEntries: { description: string; hours: string; minutes: string; rateType: 'default' | 'fixed50' }[] = [];
  readonly LABOR_RATE_DEFAULT = 34.85; // $/hr tarifa por defecto
  readonly LABOR_RATE_FIXED50 = 50;    // $/hr tarifa fija

  // Opciones avanzadas
  forceBaseCost = '';
  forceMerchantFactor = '1.5';
  forcePublicFactor = '0';
  merchantRounding = '0';
  publicRounding = '0';

  // Resultados
  resultCost = 0;
  resultLaborCost = 0;
  resultTotalCost = 0;
  resultMyProfit = 0;
  resultMerchantPrice = 0;
  resultMerchantPriceRaw = 0;
  resultPublicPrice = 0;
  resultPublicPriceRaw = 0;
  resultMerchantProfit = 0;
  resultMerchantFactor = 0; // Factor de ganancia del comerciante actual
  resultMerchantRoundingAdjust = 0; // Ajuste por redondeo (manual + Math.round)
  // Modal expandido de resultados
  private _isResultsModalOpen = false;
  get isResultsModalOpen(): boolean { return this._isResultsModalOpen; }
  set isResultsModalOpen(value: boolean) {
    this._isResultsModalOpen = value;
    // Bloquear/desbloquear scroll del body
    if (value) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }
  // Desglose completo del precio al comerciante
  resultMerchantBreakdown: {
    type: 'cost_profit' | 'cost_fixed' | 'ingredient' | 'labor' | 'rounding';
    description: string;
    cost: number;
    profit: number | null; // null para costos fijos y redondeo
    total: number;
  }[] = [];

  // Graficas
  @ViewChild('merchantFactorChartCanvas') merchantChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('publicFactorChartCanvas') publicChartRef!: ElementRef<HTMLCanvasElement>;
  merchantFactorChart!: Chart;
  publicFactorChart!: Chart;

  // Extra info
  calculationTitle = '';
  calculationLinksText = '';
  images: (string | null)[] = [null, null, null];
  currentImageIndex = 0;
  modalVisible = false;

  // Recorte de imagen
  @ViewChild('imageFileInput') imageFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('cropCanvas') cropCanvasRef!: ElementRef<HTMLCanvasElement>;
  isImageCropModalOpen = false;
  imageToCrop: HTMLImageElement | null = null;
  cropSelection: { startX: number; startY: number; endX: number; endY: number } | null = null;
  isCropping = false;
  pendingImageIndex = 0;

  // Editable ingredient
  editingIngredientId: string | null = null;
  newIngredient: Omit<Ingredient, 'id'> = { name: '', unit: '', packageSize: 1, unitValue: 0 };

  // Estado de modal de ingredientes
  openIngModal = false;
  /** Texto de búsqueda para filtrar ingredientes dentro del modal de gestión */
  ingredientModalSearch = '';

  // Estado y métodos para historial de ingredientes
  historyModalVisible = false;
  historyRecords: IngredientHistory[] = [];
  historyIngredientName = '';

  // Estado y datos para modal de comparar cálculos
  isCompareModalVisible = false;
  compareSummaries: { title: string; totalCost: number; profitWithoutProfit: number; merchantPrice: number; publicPrice: number }[] = [];
  // Modo de vista para el modal de comparación: 'all'|'prices'|'profitMerchant'
  viewMode: 'all' | 'prices' | 'profitMerchant' = 'all';

  // Modal: Guardar receta como ingrediente
  isSaveAsIngredientModalVisible = false;
  saveAsIngredientName = '';
  saveAsIngredientUnit: 'KG' | 'L' | 'PZ' = 'KG';
  saveAsIngredientYield: number = 0; // packageSize
  saveAsIngredientCost: number = 0; // unitValue (costo del lote)
  private saveAsIngredientYieldTouched = false;

  // Vista previa rápida de resultados (sin cargar el cálculo completo)
  isQuickPreviewOpen = false;
  quickPreviewCalc: CostCalculation | null = null;
  quickPreviewResults: {
    ingredientsCost: number;
    laborCost: number;
    costsWithoutProfitSum: number;
    costsWithProfitSum: number;
    baseCost: number;
    merchantFactor: number;
    merchantPrice: number;
    publicPrice: number;
    breakdown: { type: string; description: string; cost: number; profit: number | null; total: number }[];
  } | null = null;

  /** Ingredientes ordenados alfabéticamente por nombre */
  get sortedIngredients(): Ingredient[] {
    return [...this.ingredients].sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Grupos para listar cálculos guardados por carpeta, con toggle expand/collapse */
  get groupedSavedCalculations(): { key: string; label: string; items: CostCalculation[] }[] {
    const groups = new Map<string, CostCalculation[]>();
    for (const c of (this.savedCalculations || [])) {
      const key = this.normalizeFolderKey((c as any).folder);
      const arr = groups.get(key) || [];
      arr.push(c);
      groups.set(key, arr);
    }

    const out: { key: string; label: string; items: CostCalculation[] }[] = [];
    for (const [key, items] of groups.entries()) {
      // ordenar dentro del grupo por fecha desc (por seguridad)
      const ordered = [...items].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      out.push({ key, label: key ? key : 'Sin carpeta', items: ordered });
    }

    // Orden: carpetas con nombre primero (A-Z), luego "Sin carpeta" al final
    out.sort((a, b) => {
      if (a.key === '' && b.key !== '') return 1;
      if (a.key !== '' && b.key === '') return -1;
      return a.label.localeCompare(b.label);
    });

    // Inicializar defaults de expand/collapse (por UX: expandido por defecto)
    for (const g of out) {
      // Por defecto: colapsado
      if (this.folderExpandedByKey[g.key] === undefined) this.folderExpandedByKey[g.key] = false;
    }

    return out;
  }

  /** Ingredientes filtrados para el modal (por nombre/unidad). Mantiene visible el que se está editando. */
  get filteredIngredientsForModal(): Ingredient[] {
    const list = this.sortedIngredients;
    const q = this.normalizeText(this.ingredientModalSearch || '');
    if (!q) return list;

    const matches = list.filter(ing => {
      const hay = this.normalizeText(`${ing.name || ''} ${ing.unit || ''}`);
      return hay.includes(q);
    });

    // Si hay un ingrediente en edición, mantenerlo visible aunque no coincida con el filtro
    if (this.editingIngredientId) {
      const editing = list.find(i => i.id === this.editingIngredientId);
      if (editing && !matches.some(i => i.id === editing.id)) {
        return [editing, ...matches];
      }
    }
    return matches;
  }

  constructor(
    private calcService: CostCalculationService,
    private storage: Storage,
    private ingredientService: IngredientService
  ) {}

  private normalizeFolderKey(raw: any): string {
    const s = (typeof raw === 'string' ? raw : '').trim();
    return s;
  }

  isFolderExpanded(folderKey: string): boolean {
    return this.folderExpandedByKey[folderKey] !== false;
  }

  toggleFolder(folderKey: string): void {
    this.folderExpandedByKey[folderKey] = !this.isFolderExpanded(folderKey);
  }

  getFolderDraft(calc: CostCalculation): string {
    const id = calc.id || '';
    if (!id) return this.normalizeFolderKey((calc as any).folder);
    if (Object.prototype.hasOwnProperty.call(this.folderDraftByCalcId, id)) {
      return this.folderDraftByCalcId[id];
    }
    return this.normalizeFolderKey((calc as any).folder);
  }

  setFolderDraft(calc: CostCalculation, value: string): void {
    const id = calc.id || '';
    if (!id) return;
    this.folderDraftByCalcId[id] = value ?? '';
  }

  async saveCalcFolderOnEnter(calc: CostCalculation): Promise<void> {
    if (!calc.id) return;
    const id = calc.id;
    const next = this.normalizeFolderKey(this.getFolderDraft(calc));

    // Persistir en Firestore
    const ok = await this.calcService.updateCalculation(id, { folder: next } as any);
    if (!ok) {
      alert('No se pudo guardar la carpeta');
      return;
    }

    // Actualizar en memoria para que re-agrupe inmediatamente
    ;(calc as any).folder = next;
    this.folderDraftByCalcId[id] = next;

    // Asegurar que la carpeta destino quede expandida
    if (this.folderExpandedByKey[next] === undefined) this.folderExpandedByKey[next] = true;
    this.folderExpandedByKey[next] = true;
  }

  trackByCalcId(_idx: number, calc: CostCalculation): string {
    return calc.id || `${calc.title}:${calc.createdAt || 0}`;
  }

  trackByFolderKey(_idx: number, g: { key: string }): string {
    return g.key;
  }

  ngOnInit(): void {
    // Cargar posición de burbuja de cálculos guardados
    this.loadSavedCalcBubblePosition();
    // Restaurar draft si existe (antes de crear filas por defecto)
    const restored = this.restoreDraftFromCache();
    if (!restored) {
    // Inicialización básica
    this.addCostWithoutProfit();
    this.addCostWithProfit();
    }
    this.calcService.getCalculations().subscribe(calcs => this.savedCalculations = calcs);
    // Cargar lista de ingredientes
    this.ingredientService.getIngredients().subscribe(list => {
      this.ingredients = list;
      this.ingredientsLoaded = true;
      // Cuando llega/actualiza el catálogo, sincronizar textos mostrados del autocomplete
      this.syncIngredientSearchTextsWithSelection();
      // Si había un draft (o un cálculo cargado) pendiente de recalcular, hacerlo cuando ya exista el catálogo
      this.tryRecalculate('ingredientsLoaded');
    });
  }

  ngAfterViewInit(): void {
    this.initializeCharts(0);
    this.chartsReady = true;
    // Si había un draft (o un cálculo cargado) pendiente de recalcular, hacerlo cuando ya existan charts
    this.tryRecalculate('afterViewInit');
  }

  ngOnDestroy(): void {
    // Restaurar scroll del body al salir del componente
    document.body.style.overflow = '';
    // Detener rotación de imágenes
    this.stopImageRotation();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.updateIngredientDropdownPosition();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateIngredientDropdownPosition();
  }

  // Captura global de cambios para autosave (evita tocar cada input)
  @HostListener('document:input', ['$event'])
  onAnyInput(_e: Event): void {
    this.scheduleSaveDraft();
  }

  @HostListener('document:change', ['$event'])
  onAnyChange(_e: Event): void {
    this.scheduleSaveDraft();
  }

  /** Debounce para guardar draft en localStorage */
  private scheduleSaveDraft(): void {
    if (this.isRestoringDraft) return;
    if (this.draftSaveTimer) clearTimeout(this.draftSaveTimer);
    this.draftSaveTimer = setTimeout(() => {
      this.draftSaveTimer = null;
      this.saveDraftToCache();
    }, 300);
  }

  private getDraftState(): any {
    return {
      v: 1,
      savedAt: Date.now(),
      currentLoadedId: this.currentLoadedId,
      // Costos
      costsWithoutProfit: this.costsWithoutProfit,
      costsWithProfit: this.costsWithProfit,
      // Ingredientes seleccionados
      selectedIngredients: this.selectedIngredients,
      // Mano de obra
      laborEntries: this.laborEntries,
      // Opciones avanzadas
      forceBaseCost: this.forceBaseCost,
      forceMerchantFactor: this.forceMerchantFactor,
      forcePublicFactor: this.forcePublicFactor,
      merchantRounding: this.merchantRounding,
      publicRounding: this.publicRounding,
      // Extra info
      calculationTitle: this.calculationTitle,
      calculationLinksText: this.calculationLinksText,
      images: this.images,
    };
  }

  private saveDraftToCache(): void {
    try {
      const draft = this.getDraftState();
      const raw = JSON.stringify(draft);
      localStorage.setItem(this.draftStorageKey, raw);
    } catch (e) {
      // Si falla por tamaño (p.ej. imágenes grandes), intentar guardar sin imágenes
      try {
        const draft = this.getDraftState();
        draft.images = [null, null, null];
        draft.imagesOmitted = true;
        localStorage.setItem(this.draftStorageKey, JSON.stringify(draft));
      } catch (e2) {
        // Si aún falla, no bloquear al usuario
        console.warn('No se pudo guardar el draft en cache:', e2);
      }
    }
  }

  private clearDraftFromCache(): void {
    try {
      localStorage.removeItem(this.draftStorageKey);
    } catch {
      // ignore
    }
  }

  private restoreDraftFromCache(): boolean {
    try {
      const raw = localStorage.getItem(this.draftStorageKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== 1) return false;

      this.isRestoringDraft = true;
      // Aplicar campos con defaults seguros
      this.currentLoadedId = typeof parsed.currentLoadedId === 'string' ? parsed.currentLoadedId : null;

      this.costsWithoutProfit = Array.isArray(parsed.costsWithoutProfit) ? parsed.costsWithoutProfit : [];
      this.costsWithProfit = Array.isArray(parsed.costsWithProfit) ? parsed.costsWithProfit : [];

      // Asegurar al menos una fila
      if (this.costsWithoutProfit.length === 0) this.costsWithoutProfit = [{ description: '', value: '' }];
      if (this.costsWithProfit.length === 0) this.costsWithProfit = [{ description: '', value: '' }];

      this.selectedIngredients = Array.isArray(parsed.selectedIngredients) ? parsed.selectedIngredients : [];

      // Mano de obra - soportar formato nuevo (laborEntries) y antiguo (laborHours/laborMinutes)
      if (Array.isArray(parsed.laborEntries) && parsed.laborEntries.length > 0) {
        this.laborEntries = parsed.laborEntries;
      } else if (parsed.laborHours || parsed.laborMinutes) {
        // Compatibilidad con formato antiguo
        this.laborEntries = [{
          description: '',
          hours: typeof parsed.laborHours === 'string' ? parsed.laborHours : '',
          minutes: typeof parsed.laborMinutes === 'string' ? parsed.laborMinutes : '',
          rateType: 'default'
        }];
      } else {
        this.laborEntries = [];
      }

      this.forceBaseCost = typeof parsed.forceBaseCost === 'string' ? parsed.forceBaseCost : '';
      this.forceMerchantFactor = typeof parsed.forceMerchantFactor === 'string' ? parsed.forceMerchantFactor : '1.5';
      this.forcePublicFactor = typeof parsed.forcePublicFactor === 'string' ? parsed.forcePublicFactor : '0';
      this.merchantRounding = typeof parsed.merchantRounding === 'string' ? parsed.merchantRounding : '0';
      this.publicRounding = typeof parsed.publicRounding === 'string' ? parsed.publicRounding : '0';

      this.calculationTitle = typeof parsed.calculationTitle === 'string' ? parsed.calculationTitle : '';
      this.calculationLinksText = typeof parsed.calculationLinksText === 'string' ? parsed.calculationLinksText : '';

      if (Array.isArray(parsed.images)) {
        // Mantener tamaño 3
        const imgs = [...parsed.images, null, null, null].slice(0, 3);
        this.images = imgs as any;
      } else {
        this.images = [null, null, null];
      }

      this.ensureIngredientAutocompleteState();

      // No llamar calculatePrices aquí porque charts aún no existen en ngOnInit
      this.pendingRecalc = true;
      return true;
    } catch (e) {
      console.warn('No se pudo restaurar draft desde cache:', e);
      return false;
    } finally {
      this.isRestoringDraft = false;
    }
  }

  /** Limpia el formulario y borra el draft (solo cuando el usuario lo pide explícitamente) */
  clearForm(): void {
    const confirmed = confirm('¿Seguro que quieres limpiar el formulario? Se borrará el borrador local (cache).');
    if (!confirmed) return;

    this.isRestoringDraft = true;
    try {
      this.currentLoadedId = null;

      this.costsWithoutProfit = [{ description: '', value: '' }];
      this.costsWithProfit = [{ description: '', value: '' }];
      this.selectedIngredients = [];

      this.laborEntries = [];

      this.forceBaseCost = '';
      this.forceMerchantFactor = '1.5';
      this.forcePublicFactor = '0';
      this.merchantRounding = '0';
      this.publicRounding = '0';

      this.calculationTitle = '';
      this.calculationLinksText = '';
      this.images = [null, null, null];

      // Reset UI del autocomplete
      this.ingredientSearchText = [];
      this.ingredientDropdownOpen = [];
      this.activeIngredientDropdownIndex = null;
      this.ingredientDropdownAnchorEl = null;
      this.ensureIngredientAutocompleteState();

      this.clearDraftFromCache();
      // Reset resultados (opcional; se recalcularán)
      this.resultCost = 0;
      this.resultLaborCost = 0;
      this.resultTotalCost = 0;
      this.resultMyProfit = 0;
      this.resultMerchantPrice = 0;
      this.resultMerchantPriceRaw = 0;
      this.resultPublicPrice = 0;
      this.resultPublicPriceRaw = 0;
      this.resultMerchantProfit = 0;
      this.resultMerchantFactor = 0;
      this.resultMerchantRoundingAdjust = 0;
      this.resultMerchantBreakdown = [];

      // Recalcular después de limpiar (si charts existen)
      this.pendingRecalc = true;
      this.tryRecalculate('clearForm');
    } finally {
      this.isRestoringDraft = false;
    }
  }

  /** Abre modal para guardar la receta actual como ingrediente reutilizable */
  openSaveAsIngredientModal(): void {
    // Nombre sugerido
    this.saveAsIngredientName = (this.calculationTitle || '').trim() || 'Receta';
    // Unidad sugerida: por defecto KG (el usuario puede cambiarla)
    this.saveAsIngredientUnit = 'KG';

    // Calcular desglose del rendimiento (se calcula una sola vez al abrir)
    this.saveAsIngredientYieldBreakdown = this.computeYieldBreakdown();

    // Rendimiento sugerido (editable)
    this.saveAsIngredientYield = this.round3(this.getApproxYieldIn(this.saveAsIngredientUnit));
    this.saveAsIngredientYieldTouched = false;

    // Costo sugerido: costo base (ingredientes + costos sin ganancia + mano de obra). No incluye "costos con ganancia".
    this.saveAsIngredientCost = this.round2(this.computeRecipeBaseCost());

    this.isSaveAsIngredientModalVisible = true;
  }

  closeSaveAsIngredientModal(): void {
    this.isSaveAsIngredientModalVisible = false;
    this.saveAsIngredientYieldTouched = false;
  }

  onSaveAsIngredientUnitChange(next: 'KG' | 'L' | 'PZ'): void {
    this.saveAsIngredientUnit = next;
    if (!this.saveAsIngredientYieldTouched) {
      this.saveAsIngredientYield = this.round3(this.getApproxYieldIn(next));
    }
  }

  markSaveAsIngredientYieldTouched(): void {
    this.saveAsIngredientYieldTouched = true;
  }

  getSaveAsIngredientCostPerUnit(): number {
    const y = Number(this.saveAsIngredientYield || 0);
    if (!Number.isFinite(y) || y <= 0) return 0;
    return this.saveAsIngredientCost / y;
  }

  async saveRecipeAsIngredient(): Promise<void> {
    const name = (this.saveAsIngredientName || '').trim();
    if (!name) {
      alert('El nombre es requerido');
      return;
    }
    const pkg = Number(this.saveAsIngredientYield);
    const cost = Number(this.saveAsIngredientCost);
    if (!Number.isFinite(pkg) || pkg <= 0) {
      alert('El rendimiento (tamaño) debe ser mayor a 0');
      return;
    }
    if (!Number.isFinite(cost) || cost < 0) {
      alert('El costo debe ser 0 o mayor');
      return;
    }

    const confirmed = confirm(
      `Guardar "${name}" como ingrediente (${this.saveAsIngredientUnit}), rendimiento ${pkg} y costo $${cost.toFixed(2)}?`
    );
    if (!confirmed) return;

    const id = await this.ingredientService.addIngredient({
      name,
      unit: this.saveAsIngredientUnit,
      packageSize: pkg,
      unitValue: cost,
    });

    if (!id) {
      alert('Error al guardar como ingrediente');
      return;
    }
    // refrescar lista (ya hay subscribe en ngOnInit, pero forzamos inmediatez visual)
    this.ingredientService.getIngredients().subscribe(list => {
      this.ingredients = list;
      this.ingredientsLoaded = true;
      this.syncIngredientSearchTextsWithSelection();
    });
    alert('Ingrediente guardado correctamente');
    this.closeSaveAsIngredientModal();
  }

  private round2(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  private round3(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.round((n + Number.EPSILON) * 1000) / 1000;
  }

  /**
   * Costo base de la receta para guardarla como ingrediente:
   * - Incluye: ingredientes + costos sin ganancia + mano de obra
   * - Excluye: costos con ganancia (porque suelen ser extras como empaque, etc.)
   */
  private computeRecipeBaseCost(): number {
    const ingredientCost = this.sumIngredientsCost();
    const withoutProfit = this.sumCosts(this.costsWithoutProfit);
    const laborCost = this.calculateTotalLaborCost();
    return ingredientCost + withoutProfit + laborCost;
  }

  /** Rendimiento aproximado sumando cantidades de ingredientes compatibles con KG/L (ignora PZ/UN) */
  private getApproxYieldIn(unit: 'KG' | 'L' | 'PZ'): number {
    // Regla solicitada:
    // - Solo sumar ingredientes cuya unidad base sea KG o L (ignorar PZ/UN).
    // - Normalizar sub-unidades: g -> kg, ml -> L.
    // - Multiplicar por el número de porciones.
    // - Si mezclas KG y L, es solo un aproximado numérico.
    let sum = 0;
    for (const sel of (this.selectedIngredients || [])) {
      const ing = this.getIngredientById(sel.ingredientId);
      // Solo considerar ingredientes con unidad base KG o L
      if (ing?.unit === 'KG' || ing?.unit === 'L') {
        const portions = this.getPortions(sel);
        sum += this.getQuantityInIngredientUnit(sel, ing) * portions; // ya normaliza g->kg y ml->L
      }
      // Ignorar PZ, UN, u otras unidades
    }
    if (unit === 'PZ' && sum <= 0) return 1;
    return sum;
  }

  /** Desglose del cálculo del rendimiento (se calcula una vez al abrir el modal, no es un getter) */
  saveAsIngredientYieldBreakdown: { name: string; portions: number; originalQty: number; originalUnit: string; normalizedQty: number; normalizedUnit: string; ignored: boolean }[] = [];

  /** Calcula el desglose del rendimiento (llamar al abrir el modal) */
  private computeYieldBreakdown(): { name: string; portions: number; originalQty: number; originalUnit: string; normalizedQty: number; normalizedUnit: string; ignored: boolean }[] {
    const breakdown: { name: string; portions: number; originalQty: number; originalUnit: string; normalizedQty: number; normalizedUnit: string; ignored: boolean }[] = [];
    for (const sel of (this.selectedIngredients || [])) {
      const ing = this.getIngredientById(sel.ingredientId);
      const name = ing?.name || sel.ingredientId || '(sin nombre)';
      const q = Number(sel.quantity ?? 0);
      const selUnit = (sel.quantityUnit || ing?.unit || 'PZ') as string;
      const portions = this.getPortions(sel);

      if (ing?.unit === 'KG' || ing?.unit === 'L') {
        const normalizedPerPortion = this.getQuantityInIngredientUnit(sel, ing);
        const normalizedTotal = normalizedPerPortion * portions;
        breakdown.push({
          name,
          portions,
          originalQty: q,
          originalUnit: selUnit,
          normalizedQty: this.round3(normalizedTotal),
          normalizedUnit: ing.unit,
          ignored: false,
        });
      } else {
        // Ignorado
        breakdown.push({
          name,
          portions,
          originalQty: q,
          originalUnit: selUnit,
          normalizedQty: 0,
          normalizedUnit: '-',
          ignored: true,
        });
      }
    }
    return breakdown;
  }

  // Métodos de costes
  addCostWithoutProfit(): void {
    this.costsWithoutProfit.push({ description: '', value: '' });
  }

  addCostWithProfit(): void {
    this.costsWithProfit.push({ description: '', value: '' });
  }

  removeCostWithoutProfit(index: number): void {
    this.costsWithoutProfit.splice(index, 1);
  }

  removeCostWithProfit(index: number): void {
    this.costsWithProfit.splice(index, 1);
  }

  // Métodos de mano de obra
  addLaborEntry(rateType: 'default' | 'fixed50' = 'default'): void {
    this.laborEntries.push({ description: '', hours: '', minutes: '', rateType });
  }

  removeLaborEntry(index: number): void {
    this.laborEntries.splice(index, 1);
  }

  /** Calcula el costo total de mano de obra sumando todas las entradas */
  calculateTotalLaborCost(): number {
    let total = 0;
    for (const entry of this.laborEntries) {
      const h = this.evaluateExpression(entry.hours) || 0;
      const m = this.evaluateExpression(entry.minutes) || 0;
      const totalHours = h + m / 60;
      const rate = entry.rateType === 'fixed50' ? this.LABOR_RATE_FIXED50 : this.LABOR_RATE_DEFAULT;
      total += totalHours * rate;
    }
    return total;
  }

  evaluateExpression(expr: string): number {
    if (!expr || expr.trim() === '') return 0;
    if (/^-?\d+(\.\d+)?$/.test(expr.trim())) {
      return parseFloat(expr);
    }
    if (!/^[\d\s+\-*/().,^%]+$/.test(expr.replace(/\*\*/g, '^'))) {
      throw new Error('Expresión inválida');
    }
    expr = expr.replace(/\^/g, '**');
    const fn = new Function('return ' + expr);
    const result = fn();
    if (typeof result !== 'number' || isNaN(result)) throw new Error('Resultado inválido');
    return result;
  }

  sumCosts(arr: CostItem[]): number {
    return arr.reduce((sum, c) => {
      try {
        return sum + this.evaluateExpression(c.value);
      } catch {
        return sum;
      }
    }, 0);
  }

  updateTotals(): void {
    const totalWithout = this.sumCosts(this.costsWithoutProfit);
    const totalWith = this.sumCosts(this.costsWithProfit);
    // Nothing else for now, UI binds will show via methods in template
    this.scheduleSaveDraft();
  }

  calculatePrices(): void {
    // Basado en la lógica original, simplificado
    let totalWithoutProfit = this.sumCosts(this.costsWithoutProfit);
    // Sumar costo de ingredientes seleccionados
    const ingredientCost = this.sumIngredientsCost();
    totalWithoutProfit += ingredientCost;

    let totalWithProfit = this.sumCosts(this.costsWithProfit);

    const laborCost = this.calculateTotalLaborCost();

    let baseCost = totalWithoutProfit + laborCost;
    let baseCostRounded = Math.round(baseCost);

    let forcedCost: number | null = null;
    if (this.forceBaseCost.trim()) {
      try {
        forcedCost = this.evaluateExpression(this.forceBaseCost);
        baseCostRounded = Math.round(forcedCost);
      } catch (e:any) {
        alert('Error en costo base forzado: ' + e.message);
        return;
      }
    }

    let forcedFactor: number | null = null;
    if (this.forceMerchantFactor.trim()) {
      try {
        forcedFactor = this.evaluateExpression(this.forceMerchantFactor);
      } catch (e:any) {
        alert('Error en factor comerciante forzado: ' + e.message);
        return;
      }
    }

    let forcedFactorPublic: number | null = null;
    if (this.forcePublicFactor.trim()) {
      try {
        forcedFactorPublic = this.evaluateExpression(this.forcePublicFactor);
      } catch (e:any) {
        alert('Error en factor público forzado: ' + e.message);
        return;
      }
    }

    let merchantRounding = 0;
    let publicRounding = 0;
    try {
      merchantRounding = this.evaluateExpression(this.merchantRounding) || 0;
      publicRounding = this.evaluateExpression(this.publicRounding) || 0;
    } catch (e:any) {
      alert('Error en ajuste de redondeo: ' + e.message);
      return;
    }

    let costFactor = forcedCost !== null ? forcedCost : baseCostRounded;

    let merchantFactor: number;
    if (forcedFactor !== null) {
      merchantFactor = forcedFactor;
    } else if (costFactor < 77) {
      merchantFactor = 3 - Math.atan(0.06316 * (costFactor - 52.5));
    } else {
      merchantFactor = 2;
    }

    let merchantPrice = costFactor * merchantFactor;
    let merchantPriceWithCosts = merchantPrice + totalWithProfit;
    let merchantPriceAdjusted = merchantPriceWithCosts + merchantRounding;
    let merchantPriceFinal = Math.round(merchantPriceAdjusted);

    // Public price
    let publicFactor: number;
    let publicPrice: number;
    if (forcedFactorPublic !== null) {
      publicFactor = forcedFactorPublic;
      publicPrice = merchantPriceFinal * (1 + publicFactor);
    } else if (merchantPriceFinal < 100) {
      const cf = forcedCost !== null ? forcedCost : baseCostRounded;
      publicFactor = 0.3 - 0.2 * Math.atan(0.01157 * (cf - 52.5));
      publicPrice = merchantPriceFinal * (1 + publicFactor);
    } else {
      publicFactor = 0.2;
      publicPrice = merchantPriceFinal * 1.2;
    }

    let publicPriceAdjusted = publicPrice + publicRounding;
    let publicPriceFinal = Math.round(publicPriceAdjusted / 5) * 5;

    const totalCost = totalWithoutProfit + laborCost + totalWithProfit;
    const myProfit = merchantPriceFinal - totalCost;
    const merchantProfit = publicPriceFinal - merchantPriceFinal;
    const marginSin = merchantPriceFinal - totalWithProfit - (totalWithoutProfit + laborCost);

    // Asignaciones a propiedades
    this.resultCost = totalWithoutProfit + totalWithProfit;
    this.resultLaborCost = Math.round(laborCost);
    this.resultTotalCost = totalCost;
    this.resultMyProfit = marginSin;
    this.resultMerchantPrice = merchantPriceFinal;
    this.resultMerchantPriceRaw = merchantPriceWithCosts;
    this.resultPublicPrice = publicPriceFinal;
    this.resultPublicPriceRaw = publicPrice;
    this.resultMerchantProfit = merchantProfit;
    this.resultMerchantFactor = merchantFactor;

    // Calcular desglose completo del precio al comerciante
    this.resultMerchantBreakdown = [];

    // 1. Costos + ganancia (costsWithoutProfit)
    for (const c of this.costsWithoutProfit) {
      if (!c.description.trim() && !c.value.trim()) continue;
      const costValue = this.evaluateExpression(c.value) || 0;
      const profit = costValue * (merchantFactor - 1);
      this.resultMerchantBreakdown.push({
        type: 'cost_profit',
        description: c.description || '(sin descripción)',
        cost: costValue,
        profit: profit,
        total: costValue * merchantFactor
      });
    }

    // 2. Ingredientes
    for (const sel of this.selectedIngredients) {
      const ing = this.getIngredientById(sel.ingredientId);
      if (!ing) continue;
      const costValue = this.getIngredientCost(sel);
      const profit = costValue * (merchantFactor - 1);
      const portions = this.getPortions(sel);
      const qtyUnit = this.getSelectedQuantityUnit(sel) || ing.unit;
      const qtyLabel = `${sel.quantity}${qtyUnit.toLowerCase()}`;
      const desc = portions > 1
        ? `${portions}× ${ing.name} (${qtyLabel})`
        : `${ing.name} (${qtyLabel})`;
      this.resultMerchantBreakdown.push({
        type: 'ingredient',
        description: desc,
        cost: costValue,
        profit: profit,
        total: costValue * merchantFactor
      });
    }

    // 3. Mano de obra
    for (const entry of this.laborEntries) {
      const h = this.evaluateExpression(entry.hours) || 0;
      const m = this.evaluateExpression(entry.minutes) || 0;
      if (h === 0 && m === 0) continue;
      const totalHours = h + m / 60;
      const rate = entry.rateType === 'fixed50' ? this.LABOR_RATE_FIXED50 : this.LABOR_RATE_DEFAULT;
      const costValue = totalHours * rate;
      const profit = costValue * (merchantFactor - 1);
      const desc = entry.description?.trim() || `${h}h ${m}m (${entry.rateType === 'fixed50' ? '$50/hr' : '$34.85/hr'})`;
      this.resultMerchantBreakdown.push({
        type: 'labor',
        description: desc,
        cost: costValue,
        profit: profit,
        total: costValue * merchantFactor
      });
    }

    // 4. Costos fijos (costsWithProfit) - sin ganancia
    for (const c of this.costsWithProfit) {
      if (!c.description.trim() && !c.value.trim()) continue;
      const costValue = this.evaluateExpression(c.value) || 0;
      this.resultMerchantBreakdown.push({
        type: 'cost_fixed',
        description: c.description || '(sin descripción)',
        cost: costValue,
        profit: null,
        total: costValue
      });
    }

    // 5. Ajuste de redondeo (manual + Math.round)
    // roundingAdjust = merchantPriceFinal - suma de todos los totales anteriores
    const sumBreakdownTotal = this.resultMerchantBreakdown.reduce((s, item) => s + item.total, 0);
    const roundingAdjust = merchantPriceFinal - sumBreakdownTotal;
    this.resultMerchantRoundingAdjust = roundingAdjust;
    if (Math.abs(roundingAdjust) >= 0.01) {
      this.resultMerchantBreakdown.push({
        type: 'rounding',
        description: 'Ajuste redondeo',
        cost: 0,
        profit: roundingAdjust, // positivo = ganancia, negativo = pérdida
        total: roundingAdjust
      });
    }

    this.updateCharts(baseCostRounded, forcedCost, forcedFactor, forcedFactorPublic);
    this.scheduleSaveDraft();
  }

  /**
   * Recalcula resultados cuando el componente está listo.
   * - Necesita charts listos para no romper updateCharts()
   * - Si hay ingredientes seleccionados, conviene esperar a que el catálogo de ingredientes esté cargado
   */
  private tryRecalculate(_source: string): void {
    if (!this.pendingRecalc) return;
    if (!this.chartsReady) return;

    const hasAnyIngredientSelected = (this.selectedIngredients || []).some(s => !!s?.ingredientId);
    if (hasAnyIngredientSelected && !this.ingredientsLoaded) return;

    this.pendingRecalc = false;
    try {
      this.calculatePrices();
    } catch (e) {
      // Si algo falla, no bloquear; dejar marcado como pendiente por si luego se puede recalcular
      this.pendingRecalc = true;
      console.warn('Recalculo pendiente falló:', e);
    }
  }

  // Charts
  initializeCharts(baseCost: number): void {
    const merchantCtx = this.merchantChartRef.nativeElement.getContext('2d')!;
    const publicCtx = this.publicChartRef.nativeElement.getContext('2d')!;

    this.merchantFactorChart = new Chart(merchantCtx, {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'Factor Comerciante', data: [], borderColor: 'rgb(79,70,229)', tension: 0.1, fill: false }] },
      options: { responsive: true, plugins: { title: { display: true, text: 'Factor para comerciante: 0.00' } } }
    });

    this.publicFactorChart = new Chart(publicCtx, {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'Factor Público', data: [], borderColor: 'rgb(124,58,237)', tension: 0.1, fill: false }] },
      options: { responsive: true, plugins: { title: { display: true, text: 'Factor para público: 0.00' } } }
    });

    this.updateCharts(baseCost);
  }

  updateCharts(baseCost: number, forcedCost: number | null = null, forcedFactor: number | null = null, forcedFactorPublic: number | null = null): void {
    const minX = Math.max(0, baseCost - 50);
    const maxX = baseCost + 50;
    const step = (maxX - minX) / 100;

    const xValues: number[] = [];
    const merchantFactors: number[] = [];
    const publicFactors: number[] = [];

    let currentMerchantFactor = 0;
    let currentPublicFactor = 0;

    for (let x = minX; x <= maxX; x += step) {
      xValues.push(x);

      let merchantFactor: number;
      if (forcedFactor !== null) {
        merchantFactor = forcedFactor;
      } else {
        const cf = forcedCost !== null ? forcedCost : x;
        merchantFactor = cf < 77 ? 3 - Math.atan(0.06316 * (cf - 52.5)) : 2;
      }
      merchantFactors.push(merchantFactor);
      if (x === baseCost) currentMerchantFactor = merchantFactor;

      const merchantPrice = x * merchantFactor;
      let publicFactor: number;
      if (forcedFactorPublic !== null) {
        publicFactor = forcedFactorPublic;
      } else {
        if (merchantPrice < 100) {
          const cf = forcedCost !== null ? forcedCost : x;
          publicFactor = 0.3 - 0.2 * Math.atan(0.01157 * (cf - 52.5));
        } else {
          publicFactor = 0.2;
        }
      }
      publicFactors.push(publicFactor);
      if (x === baseCost) currentPublicFactor = publicFactor;
    }

    this.merchantFactorChart.data.labels = xValues as unknown as string[];
    this.merchantFactorChart.data.datasets[0].data = merchantFactors;
    (this.merchantFactorChart.options.plugins as any).title.text = `Factor para comerciante: ${currentMerchantFactor.toFixed(2)}`;
    this.merchantFactorChart.update();

    this.publicFactorChart.data.labels = xValues as unknown as string[];
    this.publicFactorChart.data.datasets[0].data = publicFactors;
    (this.publicFactorChart.options.plugins as any).title.text = `Factor para público: ${currentPublicFactor.toFixed(2)}`;
    this.publicFactorChart.update();
  }

  // Guardar cálculo (subida a Storage, luego URLs a Firestore)
  async saveCalculation(): Promise<void> {
    // Preparo el objeto sin imágenes
    // Convertir laborEntries al formato antiguo para compatibilidad (suma las horas)
    const totalLaborHours = this.laborEntries.reduce((acc, e) => acc + (this.evaluateExpression(e.hours) || 0), 0);
    const totalLaborMinutes = this.laborEntries.reduce((acc, e) => acc + (this.evaluateExpression(e.minutes) || 0), 0);
    const calcBase = {
      title: this.calculationTitle,
      links: this.calculationLinksText.split('\n').filter(l => l.trim() !== ''),
      costsWithoutProfit: this.costsWithoutProfit,
      costsWithProfit: this.costsWithProfit,
      labor: { hours: String(totalLaborHours), minutes: String(totalLaborMinutes) }, // Formato antiguo para compatibilidad
      laborEntries: this.laborEntries, // Nuevo formato
      forceBaseCost: this.forceBaseCost,
      forceMerchantFactor: this.forceMerchantFactor,
      forcePublicFactor: this.forcePublicFactor,
      merchantRounding: this.merchantRounding,
      publicRounding: this.publicRounding,
      images: [],
      selectedIngredients: this.selectedIngredients
    };
    // Crear documento sin imágenes
    const id = await this.calcService.addCalculation(calcBase);
    if (!id) {
      alert('No se pudo guardar el cálculo');
      return;
    }
    // Subir cada imagen a Storage y recopilar URLs
    const imageUrls: string[] = [];
    for (let i = 0; i < this.images.length; i++) {
      const dataUrl = this.images[i];
      if (!dataUrl) continue;
      try {
        const storageRef = ref(this.storage, `calculations/${id}/${i}`);
        await uploadString(storageRef, dataUrl, 'data_url');
        const url = await getDownloadURL(storageRef);
        imageUrls.push(url);
      } catch (e) {
        console.error('Error subiendo imagen', e);
      }
    }
    // Actualizar Firestore con URLs de las imágenes
    const success = await this.calcService.updateCalculation(id, { images: imageUrls });
    if (success) {
      console.log('Imágenes guardadas en Storage y URLs actualizadas en Firestore');
      alert('Cálculo guardado correctamente');
      this.currentLoadedId = null;
      // Guardado explícito: limpiar borrador local
      this.clearDraftFromCache();
    } else {
      alert('Error actualizando URLs de imágenes en Firestore');
    }
  }

  // Manejo de imágenes desde portapapeles y modal
  handleImageClick(index: number): void {
    this.currentImageIndex = index;
    if (this.images[index]) {
      this.modalVisible = true;
    } else if (navigator.clipboard && navigator.clipboard.read) {
      navigator.clipboard.read()
        .then(items => {
          for (const item of items) {
            if (item.types.includes('image/png')) {
              return item.getType('image/png');
            }
          }
          throw new Error('No image in clipboard');
        })
        .then(blob => {
          const reader = new FileReader();
          reader.onload = (e: any) => {
            this.images[index] = e.target.result;
            this.scheduleSaveDraft();
          };
          reader.readAsDataURL(blob);
        })
        .catch(err => alert('Error al leer portapapeles: ' + err.message));
    } else {
      alert('Tu navegador no soporta pegar imágenes directamente.');
    }
  }

  closeModal(): void {
    this.modalVisible = false;
  }

  removeCurrentImage(): void {
    this.images[this.currentImageIndex] = null;
    this.modalVisible = false;
    this.scheduleSaveDraft();
  }

  // Abrir galería para seleccionar imagen
  openGalleryForImage(index: number, event: Event): void {
    event.stopPropagation();
    this.pendingImageIndex = index;
    if (this.imageFileInput?.nativeElement) {
      this.imageFileInput.nativeElement.click();
    }
  }

  // Manejar selección de archivo de imagen
  onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    
    // Limpiar input para permitir seleccionar el mismo archivo de nuevo
    input.value = '';
    
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const dataUrl = e.target.result as string;
      this.openCropModal(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  // Abrir modal de recorte
  openCropModal(imageDataUrl: string): void {
    this.isImageCropModalOpen = true;
    this.cropSelection = null;
    this.isCropping = false;
    
    // Cargar imagen
    const img = new Image();
    img.onload = () => {
      this.imageToCrop = img;
      // Esperar al siguiente ciclo para que el canvas esté en el DOM
      setTimeout(() => this.drawCropCanvas(), 50);
    };
    img.src = imageDataUrl;
    
    // Bloquear scroll del body
    document.body.style.overflow = 'hidden';
  }

  // Cerrar modal de recorte
  closeCropModal(): void {
    this.isImageCropModalOpen = false;
    this.imageToCrop = null;
    this.cropSelection = null;
    document.body.style.overflow = '';
  }

  // Dibujar canvas con imagen y selección
  drawCropCanvas(): void {
    if (!this.cropCanvasRef?.nativeElement || !this.imageToCrop) return;
    
    const canvas = this.cropCanvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const img = this.imageToCrop;
    
    // Escalar imagen para que quepa en el canvas (máx 600x500)
    const maxW = 600;
    const maxH = 500;
    const scale = Math.min(1, maxW / img.width, maxH / img.height);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    
    canvas.width = w;
    canvas.height = h;
    
    // Dibujar imagen
    ctx.drawImage(img, 0, 0, w, h);
    
    // Dibujar selección si existe
    if (this.cropSelection) {
      const { startX, startY, endX, endY } = this.cropSelection;
      const x = Math.min(startX, endX);
      const y = Math.min(startY, endY);
      const selW = Math.abs(endX - startX);
      const selH = Math.abs(endY - startY);
      
      // Oscurecer áreas fuera de la selección
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, y); // arriba
      ctx.fillRect(0, y + selH, canvas.width, canvas.height - y - selH); // abajo
      ctx.fillRect(0, y, x, selH); // izquierda
      ctx.fillRect(x + selW, y, canvas.width - x - selW, selH); // derecha
      
      // Borde de selección
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x, y, selW, selH);
      ctx.setLineDash([]);
    }
  }

  // Obtener posición del mouse/touch relativa al canvas
  private getCropPosition(event: MouseEvent | Touch): { x: number; y: number } {
    const canvas = this.cropCanvasRef?.nativeElement;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  onCropMouseDown(event: MouseEvent): void {
    const pos = this.getCropPosition(event);
    this.isCropping = true;
    this.cropSelection = { startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y };
    this.drawCropCanvas();
  }

  onCropMouseMove(event: MouseEvent): void {
    if (!this.isCropping || !this.cropSelection) return;
    const pos = this.getCropPosition(event);
    this.cropSelection.endX = pos.x;
    this.cropSelection.endY = pos.y;
    this.drawCropCanvas();
  }

  onCropMouseUp(event: MouseEvent): void {
    this.isCropping = false;
  }

  onCropTouchStart(event: TouchEvent): void {
    event.preventDefault();
    const touch = event.touches[0];
    const pos = this.getCropPosition(touch);
    this.isCropping = true;
    this.cropSelection = { startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y };
    this.drawCropCanvas();
  }

  onCropTouchMove(event: TouchEvent): void {
    event.preventDefault();
    if (!this.isCropping || !this.cropSelection) return;
    const touch = event.touches[0];
    const pos = this.getCropPosition(touch);
    this.cropSelection.endX = pos.x;
    this.cropSelection.endY = pos.y;
    this.drawCropCanvas();
  }

  onCropTouchEnd(event: TouchEvent): void {
    this.isCropping = false;
  }

  // Verificar si hay selección válida
  get hasCropSelection(): boolean {
    if (!this.cropSelection) return false;
    const { startX, startY, endX, endY } = this.cropSelection;
    return Math.abs(endX - startX) > 10 && Math.abs(endY - startY) > 10;
  }

  // Reiniciar selección
  resetCropSelection(): void {
    this.cropSelection = null;
    this.drawCropCanvas();
  }

  // Aplicar recorte y guardar imagen
  applyCrop(): void {
    if (!this.imageToCrop || !this.cropCanvasRef?.nativeElement) {
      // Si no hay selección, usar imagen completa
      if (this.imageToCrop) {
        const canvas = document.createElement('canvas');
        canvas.width = this.imageToCrop.width;
        canvas.height = this.imageToCrop.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(this.imageToCrop, 0, 0);
          this.images[this.pendingImageIndex] = canvas.toDataURL('image/png');
          this.scheduleSaveDraft();
        }
      }
      this.closeCropModal();
      return;
    }

    const displayCanvas = this.cropCanvasRef.nativeElement;
    const img = this.imageToCrop;
    
    // Calcular escala entre canvas de visualización e imagen original
    const scaleX = img.width / displayCanvas.width;
    const scaleY = img.height / displayCanvas.height;

    let cropX: number, cropY: number, cropW: number, cropH: number;

    if (this.cropSelection && this.hasCropSelection) {
      const { startX, startY, endX, endY } = this.cropSelection;
      cropX = Math.round(Math.min(startX, endX) * scaleX);
      cropY = Math.round(Math.min(startY, endY) * scaleY);
      cropW = Math.round(Math.abs(endX - startX) * scaleX);
      cropH = Math.round(Math.abs(endY - startY) * scaleY);
    } else {
      // Sin selección: usar imagen completa
      cropX = 0;
      cropY = 0;
      cropW = img.width;
      cropH = img.height;
    }
    
    // Crear canvas final con la imagen recortada
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = cropW;
    outputCanvas.height = cropH;
    const ctx = outputCanvas.getContext('2d');
    if (!ctx) {
      this.closeCropModal();
      return;
    }
    
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    
    // Guardar como data URL
    const croppedDataUrl = outputCanvas.toDataURL('image/png');
    this.images[this.pendingImageIndex] = croppedDataUrl;
    this.scheduleSaveDraft();
    
    this.closeCropModal();
  }

  // Cargar un cálculo guardado en el formulario
  loadCalculation(calc: CostCalculation): void {
    this.currentLoadedId = calc.id ?? null;
    this.calculationTitle = calc.title;
    this.calculationLinksText = calc.links.join('\n');
    this.costsWithoutProfit = calc.costsWithoutProfit.map(c => ({ description: c.description, value: c.value }));
    this.costsWithProfit = calc.costsWithProfit.map(c => ({ description: c.description, value: c.value }));
    // Cargar mano de obra: preferir nuevo formato, fallback a formato antiguo
    if (calc.laborEntries && calc.laborEntries.length > 0) {
      this.laborEntries = calc.laborEntries.map(e => ({
        description: e.description || '',
        hours: e.hours,
        minutes: e.minutes,
        rateType: e.rateType || 'default'
      }));
    } else if (calc.labor && (calc.labor.hours || calc.labor.minutes)) {
      this.laborEntries = [{
        description: '',
        hours: calc.labor.hours,
        minutes: calc.labor.minutes,
        rateType: 'default'
      }];
    } else {
      this.laborEntries = [];
    }
    this.forceBaseCost = calc.forceBaseCost;
    this.forceMerchantFactor = calc.forceMerchantFactor;
    this.forcePublicFactor = calc.forcePublicFactor;
    this.merchantRounding = calc.merchantRounding;
    this.publicRounding = calc.publicRounding;
    this.images = [...calc.images, '', '', ''].slice(0, 3) as (string|null)[];
    this.selectedIngredients = calc.selectedIngredients || [];
    this.ensureIngredientAutocompleteState();
    this.pendingRecalc = true;
    this.tryRecalculate('loadCalculation');
    // Cargar también debe actualizar el borrador (para sobrevivir refresh)
    this.scheduleSaveDraft();
  }

  // Cargar un cálculo y cerrar el modal
  loadCalculationAndClose(calc: CostCalculation): void {
    this.loadCalculation(calc);
    this.showSavedCalculations = false;
  }

  // ============ Vista previa rápida de resultados ============
  // Cache de precios para mostrar en la lista sin recalcular cada vez
  private calcPriceCache: Map<string, number> = new Map();

  getCalcMerchantPrice(calc: CostCalculation): number {
    if (!calc.id) return 0;
    // Usar cache si existe
    if (this.calcPriceCache.has(calc.id)) {
      return this.calcPriceCache.get(calc.id)!;
    }
    // Calcular y guardar en cache
    const results = this.calculateResultsForCalc(calc);
    if (results) {
      this.calcPriceCache.set(calc.id, results.merchantPrice);
      return results.merchantPrice;
    }
    return 0;
  }

  openQuickPreview(calc: CostCalculation): void {
    this.quickPreviewCalc = calc;
    this.quickPreviewResults = this.calculateResultsForCalc(calc);
    this.isQuickPreviewOpen = true;
  }

  closeQuickPreview(): void {
    this.isQuickPreviewOpen = false;
    this.quickPreviewCalc = null;
    this.quickPreviewResults = null;
  }

  private calculateResultsForCalc(calc: CostCalculation): typeof this.quickPreviewResults {
    // Calcular costo de ingredientes
    let ingredientsCost = 0;
    for (const sel of calc.selectedIngredients || []) {
      const ing = this.getIngredientById(sel.ingredientId);
      if (!ing) continue;
      const costPerUnit = ing.unitValue / (ing.packageSize || 1);
      // Convertir cantidad según la unidad seleccionada
      let qtyInBaseUnit = sel.quantity || 0;
      const qtyUnit = sel.quantityUnit || ing.unit;
      if (qtyUnit === 'G' && ing.unit === 'KG') {
        qtyInBaseUnit = (sel.quantity || 0) / 1000;
      } else if (qtyUnit === 'ML' && ing.unit === 'L') {
        qtyInBaseUnit = (sel.quantity || 0) / 1000;
      }
      const portions = sel.portions && sel.portions > 0 ? sel.portions : 1;
      ingredientsCost += costPerUnit * qtyInBaseUnit * portions;
    }

    // Calcular mano de obra
    let laborCost = 0;
    const laborEntries = calc.laborEntries || [];
    if (laborEntries.length > 0) {
      for (const entry of laborEntries) {
        const h = this.evaluateExpression(entry.hours) || 0;
        const m = this.evaluateExpression(entry.minutes) || 0;
        const totalHours = h + m / 60;
        const rate = entry.rateType === 'fixed50' ? this.LABOR_RATE_FIXED50 : this.LABOR_RATE_DEFAULT;
        laborCost += totalHours * rate;
      }
    } else if (calc.labor) {
      // Compatibilidad con formato antiguo
      const h = this.evaluateExpression(calc.labor.hours) || 0;
      const m = this.evaluateExpression(calc.labor.minutes) || 0;
      laborCost = (h + m / 60) * this.LABOR_RATE_DEFAULT;
    }

    // Costos sin ganancia (se les agrega %)
    let costsWithoutProfitSum = 0;
    for (const c of calc.costsWithoutProfit || []) {
      costsWithoutProfitSum += this.evaluateExpression(c.value) || 0;
    }

    // Costos con ganancia (fijos)
    let costsWithProfitSum = 0;
    for (const c of calc.costsWithProfit || []) {
      costsWithProfitSum += this.evaluateExpression(c.value) || 0;
    }

    // Costo base
    const forceBaseCost = this.evaluateExpression(calc.forceBaseCost);
    const baseCost = forceBaseCost > 0 ? forceBaseCost : (ingredientsCost + laborCost + costsWithoutProfitSum);

    // Factores
    const merchantFactor = this.evaluateExpression(calc.forceMerchantFactor) || 1.5;
    const merchantRounding = this.evaluateExpression(calc.merchantRounding) || 0;
    const publicRounding = this.evaluateExpression(calc.publicRounding) || 0;

    // Precio comerciante (misma lógica que calculatePrices)
    // merchantRounding es un ajuste manual que se SUMA antes de Math.round()
    const merchantPriceWithCosts = baseCost * merchantFactor + costsWithProfitSum;
    const merchantPriceAdjusted = merchantPriceWithCosts + merchantRounding;
    const merchantPrice = Math.round(merchantPriceAdjusted);

    // Precio público (misma lógica que calculatePrices)
    let publicFactor: number;
    let publicPrice: number;
    const fpft = this.evaluateExpression(calc.forcePublicFactor);
    if (fpft !== null && fpft > 0) {
      publicFactor = fpft;
      publicPrice = merchantPrice * (1 + publicFactor);
    } else if (merchantPrice < 100) {
      const cf = forceBaseCost > 0 ? forceBaseCost : baseCost;
      publicFactor = 0.3 - 0.2 * Math.atan(0.01157 * (cf - 52.5));
      publicPrice = merchantPrice * (1 + publicFactor);
    } else {
      publicFactor = 0.2;
      publicPrice = merchantPrice * 1.2;
    }
    const publicPriceFinal = Math.round((publicPrice + publicRounding) / 5) * 5;

    // Breakdown para la tabla
    const breakdown: { type: string; description: string; cost: number; profit: number | null; total: number }[] = [];

    // Costos + ganancia
    for (const c of calc.costsWithoutProfit || []) {
      if (!c.description?.trim() && !c.value?.trim()) continue;
      const costValue = this.evaluateExpression(c.value) || 0;
      const profit = costValue * (merchantFactor - 1);
      breakdown.push({ type: 'cost_profit', description: c.description || '(sin descripción)', cost: costValue, profit, total: costValue * merchantFactor });
    }

    // Ingredientes
    for (const sel of calc.selectedIngredients || []) {
      const ing = this.getIngredientById(sel.ingredientId);
      if (!ing) continue;
      const costPerUnit = ing.unitValue / (ing.packageSize || 1);
      let qtyInBaseUnit = sel.quantity || 0;
      const qtyUnit = sel.quantityUnit || ing.unit;
      if (qtyUnit === 'G' && ing.unit === 'KG') qtyInBaseUnit = (sel.quantity || 0) / 1000;
      else if (qtyUnit === 'ML' && ing.unit === 'L') qtyInBaseUnit = (sel.quantity || 0) / 1000;
      const portions = sel.portions && sel.portions > 0 ? sel.portions : 1;
      const costValue = costPerUnit * qtyInBaseUnit * portions;
      const profit = costValue * (merchantFactor - 1);
      const label = portions > 1 ? `${portions}× ${ing.name}` : ing.name;
      breakdown.push({ type: 'ingredient', description: label, cost: costValue, profit, total: costValue * merchantFactor });
    }

    // Mano de obra
    if (laborEntries.length > 0) {
      for (const entry of laborEntries) {
        const h = this.evaluateExpression(entry.hours) || 0;
        const m = this.evaluateExpression(entry.minutes) || 0;
        if (h === 0 && m === 0) continue;
        const totalHours = h + m / 60;
        const rate = entry.rateType === 'fixed50' ? this.LABOR_RATE_FIXED50 : this.LABOR_RATE_DEFAULT;
        const costValue = totalHours * rate;
        const profit = costValue * (merchantFactor - 1);
        const rateLabel = entry.rateType === 'fixed50' ? '$50/hr' : `$${this.LABOR_RATE_DEFAULT}/hr`;
        breakdown.push({ type: 'labor', description: entry.description || `Mano de obra (${rateLabel})`, cost: costValue, profit, total: costValue * merchantFactor });
      }
    } else if (calc.labor) {
      const h = this.evaluateExpression(calc.labor.hours) || 0;
      const m = this.evaluateExpression(calc.labor.minutes) || 0;
      if (h > 0 || m > 0) {
        const costValue = (h + m / 60) * this.LABOR_RATE_DEFAULT;
        const profit = costValue * (merchantFactor - 1);
        breakdown.push({ type: 'labor', description: `Mano de obra ($${this.LABOR_RATE_DEFAULT}/hr)`, cost: costValue, profit, total: costValue * merchantFactor });
      }
    }

    // Costos fijos
    for (const c of calc.costsWithProfit || []) {
      if (!c.description?.trim() && !c.value?.trim()) continue;
      const costValue = this.evaluateExpression(c.value) || 0;
      breakdown.push({ type: 'cost_fixed', description: c.description || '(sin descripción)', cost: costValue, profit: null, total: costValue });
    }

    // Ajuste redondeo
    const sumBreakdownTotal = breakdown.reduce((s, item) => s + item.total, 0);
    const roundingAdjust = merchantPrice - sumBreakdownTotal;
    if (Math.abs(roundingAdjust) >= 0.01) {
      breakdown.push({ type: 'rounding_adjust', description: 'Ajuste redondeo', cost: 0, profit: roundingAdjust, total: roundingAdjust });
    }

    return {
      ingredientsCost: this.round2(ingredientsCost),
      laborCost: this.round2(laborCost),
      costsWithoutProfitSum: this.round2(costsWithoutProfitSum),
      costsWithProfitSum: this.round2(costsWithProfitSum),
      baseCost: this.round2(baseCost),
      merchantFactor,
      merchantPrice,
      publicPrice: publicPriceFinal,
      breakdown
    };
  }

  // ============ Métodos para rotación de imágenes en el modal de cálculos guardados ============
  private startImageRotation(): void {
    this.stopImageRotation();
    this.calcImageIndexMap.clear();
    // Iniciar índices en 0
    for (const calc of this.savedCalculations) {
      if (calc.id && calc.images && calc.images.length > 1) {
        this.calcImageIndexMap.set(calc.id, 0);
      }
    }
    // Timer para rotar cada 1.5 segundos
    this.imageRotationTimer = setInterval(() => {
      for (const calc of this.savedCalculations) {
        if (calc.id && calc.images && calc.images.length > 1) {
          const currentIndex = this.calcImageIndexMap.get(calc.id) || 0;
          const nextIndex = (currentIndex + 1) % calc.images.length;
          this.calcImageIndexMap.set(calc.id, nextIndex);
        }
      }
    }, 1500);
  }

  private stopImageRotation(): void {
    if (this.imageRotationTimer) {
      clearInterval(this.imageRotationTimer);
      this.imageRotationTimer = null;
    }
  }

  getCalcImageIndex(calc: CostCalculation): number {
    if (!calc.id) return 0;
    return this.calcImageIndexMap.get(calc.id) || 0;
  }

  getCalcDisplayImage(calc: CostCalculation): string {
    if (!calc.images || calc.images.length === 0) return '';
    const index = this.getCalcImageIndex(calc);
    return calc.images[index] || calc.images[0] || '';
  }

  // ============ Métodos para drag de la burbuja de cálculos guardados ============
  private savedCalcBubbleDragEnabled = false; // Se activa después de mantener presionado
  private savedCalcBubbleHoldTimer: any = null;
  private readonly HOLD_TO_DRAG_DELAY = 400; // ms que hay que mantener presionado para activar drag
  
  onSavedCalcBubbleClick(event: MouseEvent): void {
    // Este evento se dispara DESPUÉS de mouseup/touchend
    // Solo lo usamos como fallback - si ya procesamos el tap/click, ignoramos
    if (this.isSavedCalcBubbleDragging || Date.now() - this.savedCalcBubbleLastDragEndTime < 500) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    // Fallback: abrir modal si no fue manejado por los otros handlers
    this.showSavedCalculations = !this.showSavedCalculations;
  }

  onSavedCalcBubbleMouseDown(event: MouseEvent): void {
    this.savedCalcBubbleDragStartY = event.clientY;
    this.savedCalcBubbleDragStartTop = this.savedCalcBubbleTop;
    this.savedCalcBubbleDragEnabled = false;
    let hasMoved = false;
    const startTime = Date.now();

    // Timer para activar modo drag después de mantener presionado
    this.savedCalcBubbleHoldTimer = setTimeout(() => {
      this.savedCalcBubbleDragEnabled = true;
    }, this.HOLD_TO_DRAG_DELAY);

    const mouseMoveHandler = (e: MouseEvent) => {
      // Solo permitir drag si se mantuvo presionado el tiempo suficiente
      if (!this.savedCalcBubbleDragEnabled) return;
      
      const deltaY = Math.abs(e.clientY - this.savedCalcBubbleDragStartY);
      if (!hasMoved && deltaY > 5) {
        hasMoved = true;
        this.isSavedCalcBubbleDragging = true;
        event.preventDefault();
      }
      if (hasMoved) {
        this.onSavedCalcBubbleDragMove(e.clientY);
      }
    };

    const mouseUpHandler = (e: MouseEvent) => {
      // Cancelar timer si existe
      if (this.savedCalcBubbleHoldTimer) {
        clearTimeout(this.savedCalcBubbleHoldTimer);
        this.savedCalcBubbleHoldTimer = null;
      }
      
      if (hasMoved) {
        this.endSavedCalcBubbleDrag();
        e.preventDefault();
        e.stopPropagation();
        this.savedCalcBubbleLastDragEndTime = Date.now();
      } else {
        // Click normal - marcar tiempo para que onSavedCalcBubbleClick lo maneje
        // No hacemos nada aquí, dejamos que el evento click lo procese
      }
      this.savedCalcBubbleDragEnabled = false;
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);
    };

    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler, { once: true });
  }

  onSavedCalcBubbleTouchStart(event: TouchEvent): void {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    this.savedCalcBubbleDragStartY = touch.clientY;
    this.savedCalcBubbleDragStartTop = this.savedCalcBubbleTop;
    this.savedCalcBubbleDragEnabled = false;
    let hasMoved = false;
    const startTime = Date.now();

    // Timer para activar modo drag después de mantener presionado
    this.savedCalcBubbleHoldTimer = setTimeout(() => {
      this.savedCalcBubbleDragEnabled = true;
    }, this.HOLD_TO_DRAG_DELAY);

    const touchMoveHandler = (e: TouchEvent) => {
      // Solo permitir drag si se mantuvo presionado el tiempo suficiente
      if (!this.savedCalcBubbleDragEnabled) return;
      
      if (e.touches.length === 1) {
        const deltaY = Math.abs(e.touches[0].clientY - this.savedCalcBubbleDragStartY);
        if (!hasMoved && deltaY > 5) {
          hasMoved = true;
          this.isSavedCalcBubbleDragging = true;
          e.preventDefault();
        }
        if (hasMoved) {
          this.onSavedCalcBubbleDragMove(e.touches[0].clientY);
        }
      }
    };

    const touchEndHandler = () => {
      // Cancelar timer si existe
      if (this.savedCalcBubbleHoldTimer) {
        clearTimeout(this.savedCalcBubbleHoldTimer);
        this.savedCalcBubbleHoldTimer = null;
      }
      
      if (hasMoved) {
        this.endSavedCalcBubbleDrag();
        this.savedCalcBubbleLastDragEndTime = Date.now();
      } else {
        // Tap normal - abrir modal DIRECTAMENTE (en móvil el evento click puede no dispararse)
        const tapTime = Date.now() - startTime;
        if (tapTime < this.HOLD_TO_DRAG_DELAY + 100) { // +100ms de tolerancia
          this.showSavedCalculations = !this.showSavedCalculations;
          // Marcar tiempo para prevenir doble toggle si click se dispara después
          this.savedCalcBubbleLastDragEndTime = Date.now();
        }
      }
      this.savedCalcBubbleDragEnabled = false;
      document.removeEventListener('touchmove', touchMoveHandler);
      document.removeEventListener('touchend', touchEndHandler);
    };

    document.addEventListener('touchmove', touchMoveHandler, { passive: false });
    document.addEventListener('touchend', touchEndHandler, { once: true });
  }

  private onSavedCalcBubbleDragMove(clientY: number): void {
    if (!this.isSavedCalcBubbleDragging) return;
    const deltaY = clientY - this.savedCalcBubbleDragStartY;
    const viewportHeight = window.innerHeight;
    const deltaPercent = (deltaY / viewportHeight) * 100;
    let newTop = this.savedCalcBubbleDragStartTop + deltaPercent;
    // Limitar entre 5% y 95%
    newTop = Math.max(5, Math.min(95, newTop));
    this.savedCalcBubbleTop = newTop;
  }

  private endSavedCalcBubbleDrag(): void {
    if (this.isSavedCalcBubbleDragging) {
      this.isSavedCalcBubbleDragging = false;
      this.savedCalcBubbleLastDragEndTime = Date.now();
      this.saveSavedCalcBubblePosition();
    }
  }

  private saveSavedCalcBubblePosition(): void {
    try {
      localStorage.setItem('calculadora_savedCalcBubblePosition', JSON.stringify(this.savedCalcBubbleTop));
    } catch (error) {
      console.error('Error al guardar posición de burbuja:', error);
    }
  }

  private loadSavedCalcBubblePosition(): void {
    try {
      const saved = localStorage.getItem('calculadora_savedCalcBubblePosition');
      if (saved) {
        const position = JSON.parse(saved);
        if (typeof position === 'number' && position >= 5 && position <= 95) {
          this.savedCalcBubbleTop = position;
        }
      }
    } catch (error) {
      console.error('Error al cargar posición de burbuja:', error);
    }
  }

  // Eliminar un cálculo guardado
  deleteSavedCalculation(calc: CostCalculation): void {
    if (!calc.id) return;
    const confirmed = confirm('¿Está seguro de que desea eliminar este cálculo?');
    if (!confirmed) return;
    this.calcService.deleteCalculation(calc.id)
      .then(success => {
        if (!success) {
          alert('No se pudo eliminar el cálculo');
        }
      });
  }

  // Editar (sobreescribir) el cálculo actualmente cargado
  async editCalculation(): Promise<void> {
    if (!this.currentLoadedId) return;
    const id = this.currentLoadedId;
    
    // Subir imágenes a Storage (si son data URLs) y obtener URLs públicas
    const imageUrls: string[] = [];
    for (let i = 0; i < this.images.length; i++) {
      const img = this.images[i];
      if (!img) continue;
      
      // Si ya es una URL de Firebase Storage, usarla directamente
      if (img.startsWith('https://firebasestorage.googleapis.com') || img.startsWith('https://storage.googleapis.com')) {
        imageUrls.push(img);
      } else if (img.startsWith('data:')) {
        // Es un data URL, subir a Storage
        try {
          const storageRef = ref(this.storage, `calculations/${id}/${i}_${Date.now()}`);
          await uploadString(storageRef, img, 'data_url');
          const url = await getDownloadURL(storageRef);
          imageUrls.push(url);
        } catch (e) {
          console.error('Error subiendo imagen', e);
        }
      }
    }
    
    // Convertir laborEntries al formato antiguo para compatibilidad
    const totalLaborHours = this.laborEntries.reduce((acc, e) => acc + (this.evaluateExpression(e.hours) || 0), 0);
    const totalLaborMinutes = this.laborEntries.reduce((acc, e) => acc + (this.evaluateExpression(e.minutes) || 0), 0);
    const calculation = {
      title: this.calculationTitle,
      links: this.calculationLinksText.split('\n').filter(l => l.trim() !== ''),
      costsWithoutProfit: this.costsWithoutProfit,
      costsWithProfit: this.costsWithProfit,
      labor: { hours: String(totalLaborHours), minutes: String(totalLaborMinutes) }, // Formato antiguo
      laborEntries: this.laborEntries, // Nuevo formato
      forceBaseCost: this.forceBaseCost,
      forceMerchantFactor: this.forceMerchantFactor,
      forcePublicFactor: this.forcePublicFactor,
      merchantRounding: this.merchantRounding,
      publicRounding: this.publicRounding,
      images: imageUrls,
      selectedIngredients: this.selectedIngredients
    };
    const success = await this.calcService.updateCalculation(id, calculation);
    if (success) {
      // Actualizar las imágenes locales con las URLs de Storage
      this.images = [...imageUrls, null, null, null].slice(0, 3) as (string | null)[];
      alert('Cálculo actualizado correctamente');
      // Guardado explícito: limpiar borrador local
      this.clearDraftFromCache();
    } else {
      alert('No se pudo actualizar el cálculo');
    }
    // Mantener currentLoadedId para futuras ediciones
  }

  // Métodos de gestión de ingredientes
  addIngredient(): void {
    this.selectedIngredients.push({ ingredientId: '', quantity: 1 });
    this.ingredientSearchText.push('');
    this.ingredientDropdownOpen.push(false);
  }

  removeIngredient(index: number): void {
    this.selectedIngredients.splice(index, 1);
    this.ingredientSearchText.splice(index, 1);
    this.ingredientDropdownOpen.splice(index, 1);
  }

  /** Mover ingrediente hacia arriba */
  moveIngredientUp(index: number): void {
    if (index <= 0) return;
    // Intercambiar con el anterior
    [this.selectedIngredients[index], this.selectedIngredients[index - 1]] =
      [this.selectedIngredients[index - 1], this.selectedIngredients[index]];
    [this.ingredientSearchText[index], this.ingredientSearchText[index - 1]] =
      [this.ingredientSearchText[index - 1], this.ingredientSearchText[index]];
    [this.ingredientDropdownOpen[index], this.ingredientDropdownOpen[index - 1]] =
      [this.ingredientDropdownOpen[index - 1], this.ingredientDropdownOpen[index]];
    this.scheduleSaveDraft();
  }

  /** Mover ingrediente hacia abajo */
  moveIngredientDown(index: number): void {
    if (index >= this.selectedIngredients.length - 1) return;
    // Intercambiar con el siguiente
    [this.selectedIngredients[index], this.selectedIngredients[index + 1]] =
      [this.selectedIngredients[index + 1], this.selectedIngredients[index]];
    [this.ingredientSearchText[index], this.ingredientSearchText[index + 1]] =
      [this.ingredientSearchText[index + 1], this.ingredientSearchText[index]];
    [this.ingredientDropdownOpen[index], this.ingredientDropdownOpen[index + 1]] =
      [this.ingredientDropdownOpen[index + 1], this.ingredientDropdownOpen[index]];
    this.scheduleSaveDraft();
  }

  // Cálculo de costo por ingrediente
  getIngredientCost(sel: SelectedIngredientRow): number {
    const ing = this.ingredients.find(i => i.id === sel.ingredientId);
    if (!ing) return 0;
    // costo unitario por unidad = unitValue / packageSize
    const costPerUnit = ing.unitValue / ing.packageSize;
    const qtyInIngredientUnit = this.getQuantityInIngredientUnit(sel, ing);
    const portions = sel.portions && sel.portions > 0 ? sel.portions : 1;
    return costPerUnit * qtyInIngredientUnit * portions;
  }

  /** Obtiene el número de porciones (mínimo 1) */
  getPortions(sel: SelectedIngredientRow): number {
    return sel.portions && sel.portions > 0 ? sel.portions : 1;
  }

  // Suma total de ingredientes
  sumIngredientsCost(): number {
    return this.selectedIngredients.reduce((sum, sel) => sum + this.getIngredientCost(sel), 0);
  }

  /** Suma de la columna Costo en el desglose del comerciante */
  getBreakdownSumCost(): number {
    return this.resultMerchantBreakdown.reduce((sum, item) => sum + item.cost, 0);
  }

  /** Suma de la columna Ganancia en el desglose del comerciante */
  getBreakdownSumProfit(): number {
    return this.resultMerchantBreakdown.reduce((sum, item) => sum + (item.profit ?? 0), 0);
  }

  /** Suma de la columna Total en el desglose del comerciante */
  getBreakdownSumTotal(): number {
    return this.resultMerchantBreakdown.reduce((sum, item) => sum + item.total, 0);
  }

  /** Unidades permitidas para capturar cantidades según la unidad base del ingrediente */
  getAllowedQuantityUnits(ingredientId: string | undefined): RecipeQtyUnit[] {
    const ing = this.ingredients.find(i => i.id === ingredientId);
    if (!ing?.unit) return [];
    if (ing.unit === 'KG') return ['KG', 'G'];
    if (ing.unit === 'L') return ['L', 'ML'];
    if (ing.unit === 'PZ') return ['PZ'];
    // Fallback: si llega otra unidad, solo permitir la misma
    return [ing.unit as any];
  }

  /** Devuelve la unidad seleccionada para capturar la receta (fallback a unidad base del ingrediente) */
  getSelectedQuantityUnit(sel: SelectedIngredientRow): RecipeQtyUnit | '' {
    const ing = this.ingredients.find(i => i.id === sel.ingredientId);
    const base = (ing?.unit || '') as any;
    const u = (sel.quantityUnit || base) as any;
    return u || '';
  }

  /** Label corto para UI */
  formatQtyUnitLabel(u: RecipeQtyUnit): string {
    if (u === 'KG') return 'kg';
    if (u === 'G') return 'g';
    if (u === 'L') return 'L';
    if (u === 'ML') return 'ml';
    if (u === 'PZ') return 'pz';
    return String(u);
  }

  /** Cambia la unidad de captura para una fila (mantiene compatibilidad: si es la base, no se guarda) */
  onQuantityUnitChange(index: number, nextUnit: RecipeQtyUnit): void {
    const sel = this.selectedIngredients[index];
    if (!sel) return;
    const ing = this.ingredients.find(i => i.id === sel.ingredientId);
    const base = (ing?.unit || '') as any;
    if (!nextUnit) return;
    if (base && nextUnit === base) {
      delete (sel as any).quantityUnit;
    } else {
      (sel as any).quantityUnit = nextUnit;
    }
    this.calculatePrices();
  }

  /** Convierte la cantidad capturada a la unidad base del ingrediente (KG o L) */
  private getQuantityInIngredientUnit(sel: SelectedIngredientRow, ing: Ingredient): number {
    const raw = Number(sel.quantity ?? 0);
    if (!Number.isFinite(raw)) return 0;
    if (!ing?.unit) return raw;

    const u = (sel.quantityUnit || ing.unit) as any;

    // Base KG: permitir KG o G
    if (ing.unit === 'KG') {
      if (u === 'G') return raw / 1000;
      return raw; // KG (o fallback)
    }

    // Base L: permitir L o ML
    if (ing.unit === 'L') {
      if (u === 'ML') return raw / 1000;
      return raw; // L (o fallback)
    }

    // PZ u otros: sin conversión
    return raw;
  }

  /** Devuelve el ingrediente completo según su id */
  getIngredientById(id: string | undefined): Ingredient | undefined {
    return this.ingredients.find(i => i.id === id);
  }

  /** Normaliza texto para búsqueda (minúsculas y sin acentos) */
  private normalizeText(input: string): string {
    return (input || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /** Asegura que los arrays de UI tengan el mismo largo que selectedIngredients */
  private ensureIngredientAutocompleteState(): void {
    const n = this.selectedIngredients.length;
    if (!Array.isArray(this.ingredientSearchText)) this.ingredientSearchText = [];
    if (!Array.isArray(this.ingredientDropdownOpen)) this.ingredientDropdownOpen = [];

    // Ajustar largo
    this.ingredientSearchText.length = n;
    this.ingredientDropdownOpen.length = n;

    for (let i = 0; i < n; i++) {
      if (typeof this.ingredientSearchText[i] !== 'string') this.ingredientSearchText[i] = '';
      if (typeof this.ingredientDropdownOpen[i] !== 'boolean') this.ingredientDropdownOpen[i] = false;
    }

    this.syncIngredientSearchTextsWithSelection();
  }

  /** Asegura arrays UI con el largo correcto sin re-llamar sync (para evitar loops) */
  private ensureIngredientAutocompleteStateShallow(): void {
    const n = this.selectedIngredients.length;
    if (!Array.isArray(this.ingredientSearchText)) this.ingredientSearchText = [];
    if (!Array.isArray(this.ingredientDropdownOpen)) this.ingredientDropdownOpen = [];

    this.ingredientSearchText.length = n;
    this.ingredientDropdownOpen.length = n;

    for (let i = 0; i < n; i++) {
      if (typeof this.ingredientSearchText[i] !== 'string') this.ingredientSearchText[i] = '';
      if (typeof this.ingredientDropdownOpen[i] !== 'boolean') this.ingredientDropdownOpen[i] = false;
    }
  }

  /** Sincroniza el texto mostrado con el ingrediente seleccionado (si existe) */
  private syncIngredientSearchTextsWithSelection(): void {
    this.ensureIngredientAutocompleteStateShallow();
    for (let i = 0; i < this.selectedIngredients.length; i++) {
      const id = this.selectedIngredients[i]?.ingredientId;
      if (!id) continue;
      const ing = this.getIngredientById(id);
      if (ing?.name && (!this.ingredientSearchText[i] || this.ingredientSearchText[i].trim() === '')) {
        this.ingredientSearchText[i] = ing.name;
      }
    }
  }

  /** Abre el dropdown del autocomplete para una fila */
  openIngredientDropdown(index: number, anchorEl?: HTMLElement): void {
    this.ensureIngredientAutocompleteState();
    // Cerrar otros
    for (let i = 0; i < this.ingredientDropdownOpen.length; i++) {
      this.ingredientDropdownOpen[i] = i === index;
    }
    this.activeIngredientDropdownIndex = index;
    this.ingredientDropdownAnchorEl = anchorEl || null;
    this.ingredientDropdownOpen[index] = true;
    this.updateIngredientDropdownPosition();
  }

  /** Cierra el dropdown del autocomplete para una fila (con delay para permitir click en opciones) */
  closeIngredientDropdown(index: number): void {
    const closeFor = index;
    setTimeout(() => {
      if (this.activeIngredientDropdownIndex !== closeFor) return;
      if (this.ingredientDropdownOpen[closeFor] !== undefined) this.ingredientDropdownOpen[closeFor] = false;
      this.activeIngredientDropdownIndex = null;
      this.ingredientDropdownAnchorEl = null;
    }, 150);
  }

  /** Maneja cambios del texto de búsqueda */
  onIngredientSearchChange(index: number, value: string, anchorEl?: HTMLElement): void {
    this.ensureIngredientAutocompleteState();
    this.ingredientSearchText[index] = value ?? '';
    this.openIngredientDropdown(index, anchorEl);

    // Si el usuario edita el texto manualmente, des-seleccionar para evitar inconsistencias
    const currentId = this.selectedIngredients[index]?.ingredientId;
    if (currentId) {
      const currentName = this.getIngredientById(currentId)?.name || '';
      if (this.normalizeText(currentName) !== this.normalizeText(this.ingredientSearchText[index])) {
        this.selectedIngredients[index].ingredientId = '';
        delete (this.selectedIngredients[index] as any).quantityUnit;
        this.calculatePrices();
      }
    }
  }

  /** Devuelve opciones filtradas para una fila (limitadas para performance) */
  getFilteredIngredients(index: number): Ingredient[] {
    const q = this.normalizeText(this.ingredientSearchText[index] || '');
    const list = this.sortedIngredients;
    if (!q) return list.slice(0, 50);
    const filtered = list.filter(ing => this.normalizeText(ing.name).includes(q));
    return filtered.slice(0, 50);
  }

  /** Selecciona un ingrediente desde el autocomplete */
  selectIngredientFromAutocomplete(index: number, ing: Ingredient): void {
    if (!ing?.id) return;
    this.ensureIngredientAutocompleteState();
    const prevId = this.selectedIngredients[index].ingredientId;
    this.selectedIngredients[index].ingredientId = ing.id;
    if (prevId !== ing.id) {
      // Cambió el ingrediente: reiniciar unidad de captura para evitar unidades incompatibles (p.ej. ML -> KG)
      delete (this.selectedIngredients[index] as any).quantityUnit;
    }
    this.ingredientSearchText[index] = ing.name;
    this.ingredientDropdownOpen[index] = false;
    if (this.activeIngredientDropdownIndex === index) {
      this.activeIngredientDropdownIndex = null;
      this.ingredientDropdownAnchorEl = null;
    }
    this.calculatePrices();
  }

  /** Teclas útiles: Enter selecciona el primer resultado, Escape cierra */
  onIngredientSearchKeydown(index: number, e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.ingredientDropdownOpen[index] = false;
      if (this.activeIngredientDropdownIndex === index) {
        this.activeIngredientDropdownIndex = null;
        this.ingredientDropdownAnchorEl = null;
      }
      return;
    }
    if (e.key === 'Enter') {
      const opts = this.getFilteredIngredients(index);
      if ((this.activeIngredientDropdownIndex === index) && opts.length > 0) {
        e.preventDefault();
        this.selectIngredientFromAutocomplete(index, opts[0]);
      }
    }
    if (e.key === 'ArrowDown') {
      this.openIngredientDropdown(index, this.ingredientDropdownAnchorEl || undefined);
    }
  }

  /** Recalcula la posición del dropdown (overlay) basado en el input activo */
  private updateIngredientDropdownPosition(): void {
    if (this.activeIngredientDropdownIndex === null) return;
    if (!this.ingredientDropdownAnchorEl) return;
    const rect = this.ingredientDropdownAnchorEl.getBoundingClientRect();
    this.ingredientDropdownTop = Math.round(rect.bottom + 4);
    this.ingredientDropdownLeft = Math.round(rect.left);
    this.ingredientDropdownWidth = Math.round(rect.width);
  }

  // Seleccionar un ingrediente para editar en la gestión
  selectIngredient(ing: Ingredient): void {
    this.editingIngredientId = ing.id ?? null;
    this.newIngredient = { name: ing.name, unit: ing.unit, packageSize: ing.packageSize, unitValue: ing.unitValue };
  }

  // Abrir modal de gestión
  openIngredientsModal(): void {
    this.editingIngredientId = null;
    this.newIngredient = { name: '', unit: '', packageSize: 1, unitValue: 0 };
    this.ingredientModalSearch = '';
    this.openIngModal = true;
  }

  closeIngredientsModal(): void {
    this.openIngModal = false;
  }

  trackByIngredientId(index: number, ing: Ingredient): string {
    return ing.id || String(index);
  }

  // Guardar o actualizar ingrediente
  async saveIngredient(): Promise<void> {
    if (this.editingIngredientId) {
      // Actualizar inline sin cerrar modal
      const success = await this.ingredientService.updateIngredient(this.editingIngredientId, this.newIngredient);
      if (!success) {
        alert('Error al actualizar ingrediente');
      } else {
        // recargar lista y salir modo edición
        this.ingredientService.getIngredients().subscribe(list => this.ingredients = list);
        this.editingIngredientId = null;
        this.newIngredient = { name: '', unit: '', packageSize: 1, unitValue: 0 };
      }
    } else {
      // Agregar nuevo ingrediente (mantener modal abierto)
      const id = await this.ingredientService.addIngredient(this.newIngredient);
      if (!id) {
        alert('Error al añadir ingrediente');
      } else {
        this.ingredientService.getIngredients().subscribe(list => this.ingredients = list);
        this.newIngredient = { name: '', unit: '', packageSize: 1, unitValue: 0 };
      }
    }
  }

  /** Cancela la edición inline de un ingrediente */
  cancelInlineEdit(): void {
    this.editingIngredientId = null;
    this.newIngredient = { name: '', unit: '', packageSize: 1, unitValue: 0 };
  }

  // Eliminar ingrediente
  async deleteIngredientFromModal(id: string): Promise<void> {
    const confirmed = confirm('¿Eliminar ingrediente?');
    if (!confirmed) return;
    const success = await this.ingredientService.deleteIngredient(id);
    if (!success) alert('Error al eliminar ingrediente');
    this.ingredientService.getIngredients().subscribe(list => this.ingredients = list);
  }

  // Cargar ingrediente en formulario
  editIngredient(ing: Ingredient): void {
    this.editingIngredientId = ing.id || null;
    this.newIngredient = { name: ing.name, unit: ing.unit, packageSize: ing.packageSize, unitValue: ing.unitValue };
    this.openIngModal = true;
  }

  // Pegar desde Excel (tab-separated)
  pasteIngredients(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text') || '';
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    lines.forEach(async line => {
      // Solo dividir por tabulaciones para respetar espacios en el nombre
      const parts = line.split('\t').map(p => p.trim());
      if (parts.length < 4) return;
      const [name, unit, pkg, val] = parts;
      const packageSize = parseFloat(pkg.replace(',', '.'));
      const unitValue = parseFloat(val.replace(/[^0-9.,-]+/g, '').replace(',', '.'));
      await this.ingredientService.addIngredient({ name, unit, packageSize, unitValue });
    });
    setTimeout(() => this.ingredientService.getIngredients().subscribe(list => this.ingredients = list), 500);
  }

  /** Exporta los ingredientes a un archivo Excel */
  exportIngredients(): void {
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.json_to_sheet(this.sortedIngredients.map(ing => ({
        Nombre: ing.name,
        Unidad: ing.unit,
        TamanoEmpaque: ing.packageSize,
        ValorUnitario: ing.unitValue
      })));
      const wb = { Sheets: { 'Ingredientes': ws }, SheetNames: ['Ingredientes'] };
      const excelBuffer: any = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ingredientes.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    }).catch(err => console.error('Error al exportar Excel:', err));
  }

  /** Abre el modal flotante con el historial de cambios */
  openHistory(ing: Ingredient): void {
    if (!ing.id) return;
    this.ingredientService.getIngredientHistory(ing.id)
      .subscribe(records => {
        this.historyRecords = records;
        this.historyIngredientName = ing.name;
        this.historyModalVisible = true;
      });
  }

  /** Cierra el modal de historial */
  closeHistory(): void {
    this.historyModalVisible = false;
    this.historyRecords = [];
    this.historyIngredientName = '';
  }

  // Calcula resumen de un cálculo guardado para comparación
  calculateSummary(calc: CostCalculation) {
    const sumWithoutCosts = calc.costsWithoutProfit.reduce((sum, c) => {
      try { return sum + this.evaluateExpression(c.value); } catch { return sum; }
    }, 0);
    const ingredientCost = calc.selectedIngredients.reduce((sum, sel) => sum + this.getIngredientCost(sel), 0);
    const sumWithout = sumWithoutCosts + ingredientCost;
    const sumWith = calc.costsWithProfit.reduce((sum, c) => {
      try { return sum + this.evaluateExpression(c.value); } catch { return sum; }
    }, 0);
    // Calcular mano de obra: preferir nuevo formato, fallback a formato antiguo
    let laborCost = 0;
    if (calc.laborEntries && calc.laborEntries.length > 0) {
      for (const entry of calc.laborEntries) {
        const h = this.evaluateExpression(entry.hours) || 0;
        const m = this.evaluateExpression(entry.minutes) || 0;
        const totalHours = h + m / 60;
        const rate = entry.rateType === 'fixed50' ? this.LABOR_RATE_FIXED50 : this.LABOR_RATE_DEFAULT;
        laborCost += totalHours * rate;
      }
    } else if (calc.labor) {
      const laborH = this.evaluateExpression(calc.labor.hours) || 0;
      const laborM = this.evaluateExpression(calc.labor.minutes) || 0;
      const laborTotal = laborH + laborM / 60;
      laborCost = laborTotal * this.LABOR_RATE_DEFAULT;
    }
    let baseCost = sumWithout + laborCost;
    let forcedCost: number | null = null;
    if (calc.forceBaseCost.trim()) {
      try { forcedCost = this.evaluateExpression(calc.forceBaseCost); baseCost = forcedCost; } catch {}
    }
    const baseCostRounded = Math.round(baseCost);
    let merchantFactor: number;
    let fft: number | null = null;
    if (calc.forceMerchantFactor.trim()) {
      try { fft = this.evaluateExpression(calc.forceMerchantFactor); } catch {}
    }
    if (fft !== null) merchantFactor = fft;
    else if (baseCostRounded < 77) merchantFactor = 3 - Math.atan(0.06316 * (baseCostRounded - 52.5));
    else merchantFactor = 2;
    const merchantPrice = baseCostRounded * merchantFactor;
    const merchantPriceWithCosts = merchantPrice + sumWith;
    const roundingM = this.evaluateExpression(calc.merchantRounding) || 0;
    const merchantPriceFinal = Math.round(merchantPriceWithCosts + roundingM);
    let publicFactor: number;
    let publicPrice: number;
    let fpft: number | null = null;
    if (calc.forcePublicFactor.trim()) {
      try { fpft = this.evaluateExpression(calc.forcePublicFactor); } catch {}
    }
    if (fpft !== null) {
      publicFactor = fpft;
      publicPrice = merchantPriceFinal * (1 + publicFactor);
    } else if (merchantPriceFinal < 100) {
      const cf = forcedCost !== null ? forcedCost : baseCostRounded;
      publicFactor = 0.3 - 0.2 * Math.atan(0.01157 * (cf - 52.5));
      publicPrice = merchantPriceFinal * (1 + publicFactor);
    } else {
      publicFactor = 0.2;
      publicPrice = merchantPriceFinal * 1.2;
    }
    const publicPriceFinal = Math.round((publicPrice + (this.evaluateExpression(calc.publicRounding) || 0)) / 5) * 5;
    const profitWithoutProfit = merchantPriceFinal - sumWith - (sumWithout + laborCost);
    const totalCost = sumWithout + laborCost + sumWith;
    return { title: calc.title, totalCost, profitWithoutProfit, merchantPrice: merchantPriceFinal, publicPrice: publicPriceFinal };
  }

  // Abre y cierra modal de comparar cálculos
  openCompareModal(): void {
    this.compareSummaries = this.savedCalculations.map(calc => this.calculateSummary(calc));
    this.isCompareModalVisible = true;
  }

  closeCompareModal(): void {
    this.isCompareModalVisible = false;
  }
} 