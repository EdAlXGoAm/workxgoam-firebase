import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CostCalculationService, CostItem, CostCalculation } from '../../services/cost-calculation.service';
import Chart from 'chart.js/auto';
import { IngredientService, Ingredient, IngredientHistory } from '../../services/ingredient.service';
import { Storage, ref, uploadString, getDownloadURL } from '@angular/fire/storage';

@Component({
  selector: 'app-calculadora',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calculadora.component.html',
  styles: []
})
export class CalculadoraComponent implements OnInit, AfterViewInit {
  // Ingredientes
  ingredients: Ingredient[] = [];
  selectedIngredients: { ingredientId: string; quantity: number }[] = [];
  // ID del cálculo actualmente cargado (null si es nuevo)
  currentLoadedId: string | null = null;
  // Lista de cálculos guardados
  savedCalculations: CostCalculation[] = [];
  // Costos
  costsWithoutProfit: CostItem[] = [];
  costsWithProfit: CostItem[] = [];

  // Labor
  laborHours = '';
  laborMinutes = '';

  // Opciones avanzadas
  forceBaseCost = '';
  forceMerchantFactor = '';
  forcePublicFactor = '';
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

  // Editable ingredient
  editingIngredientId: string | null = null;
  newIngredient: Omit<Ingredient, 'id'> = { name: '', unit: '', packageSize: 1, unitValue: 0 };

  // Estado de modal de ingredientes
  openIngModal = false;

  // Estado y métodos para historial de ingredientes
  historyModalVisible = false;
  historyRecords: IngredientHistory[] = [];
  historyIngredientName = '';

  // Estado y datos para modal de comparar cálculos
  isCompareModalVisible = false;
  compareSummaries: { title: string; totalCost: number; profitWithoutProfit: number; merchantPrice: number; publicPrice: number }[] = [];
  // Mostrar solo precios en modal comparar
  showOnlyPrices = false;

  /** Ingredientes ordenados alfabéticamente por nombre */
  get sortedIngredients(): Ingredient[] {
    return [...this.ingredients].sort((a, b) => a.name.localeCompare(b.name));
  }

  constructor(
    private calcService: CostCalculationService,
    private storage: Storage,
    private ingredientService: IngredientService
  ) {}

  ngOnInit(): void {
    // Inicialización básica
    this.addCostWithoutProfit();
    this.addCostWithProfit();
    this.calcService.getCalculations().subscribe(calcs => this.savedCalculations = calcs);
    // Cargar lista de ingredientes
    this.ingredientService.getIngredients().subscribe(list => this.ingredients = list);
  }

  ngAfterViewInit(): void {
    this.initializeCharts(0);
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
  }

  calculatePrices(): void {
    // Basado en la lógica original, simplificado
    let totalWithoutProfit = this.sumCosts(this.costsWithoutProfit);
    // Sumar costo de ingredientes seleccionados
    const ingredientCost = this.sumIngredientsCost();
    totalWithoutProfit += ingredientCost;

    let totalWithProfit = this.sumCosts(this.costsWithProfit);

    let laborH = 0;
    let laborM = 0;
    try {
      laborH = this.evaluateExpression(this.laborHours) || 0;
      laborM = this.evaluateExpression(this.laborMinutes) || 0;
    } catch (e:any) {
      alert('Error en mano de obra: ' + e.message);
      return;
    }
    const laborTotal = laborH + laborM / 60;
    const laborCost = laborTotal * 34.85;

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

    this.updateCharts(baseCostRounded, forcedCost, forcedFactor, forcedFactorPublic);
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
    const calcBase = {
      title: this.calculationTitle,
      links: this.calculationLinksText.split('\n').filter(l => l.trim() !== ''),
      costsWithoutProfit: this.costsWithoutProfit,
      costsWithProfit: this.costsWithProfit,
      labor: { hours: this.laborHours, minutes: this.laborMinutes },
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
  }

  // Cargar un cálculo guardado en el formulario
  loadCalculation(calc: CostCalculation): void {
    this.currentLoadedId = calc.id ?? null;
    this.calculationTitle = calc.title;
    this.calculationLinksText = calc.links.join('\n');
    this.costsWithoutProfit = calc.costsWithoutProfit.map(c => ({ description: c.description, value: c.value }));
    this.costsWithProfit = calc.costsWithProfit.map(c => ({ description: c.description, value: c.value }));
    this.laborHours = calc.labor.hours;
    this.laborMinutes = calc.labor.minutes;
    this.forceBaseCost = calc.forceBaseCost;
    this.forceMerchantFactor = calc.forceMerchantFactor;
    this.forcePublicFactor = calc.forcePublicFactor;
    this.merchantRounding = calc.merchantRounding;
    this.publicRounding = calc.publicRounding;
    this.images = [...calc.images, '', '', ''].slice(0, 3) as (string|null)[];
    this.selectedIngredients = calc.selectedIngredients || [];
    this.calculatePrices();
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
    const calculation = {
      title: this.calculationTitle,
      links: this.calculationLinksText.split('\n').filter(l => l.trim() !== ''),
      costsWithoutProfit: this.costsWithoutProfit,
      costsWithProfit: this.costsWithProfit,
      labor: { hours: this.laborHours, minutes: this.laborMinutes },
      forceBaseCost: this.forceBaseCost,
      forceMerchantFactor: this.forceMerchantFactor,
      forcePublicFactor: this.forcePublicFactor,
      merchantRounding: this.merchantRounding,
      publicRounding: this.publicRounding,
      images: this.images.filter(img => img !== null) as string[],
      selectedIngredients: this.selectedIngredients
    };
    const success = await this.calcService.updateCalculation(this.currentLoadedId, calculation);
    if (success) {
      alert('Cálculo actualizado correctamente');
    } else {
      alert('No se pudo actualizar el cálculo');
    }
    // Mantener currentLoadedId para futuras ediciones o limpiarlo si prefieres
  }

  // Métodos de gestión de ingredientes
  addIngredient(): void {
    this.selectedIngredients.push({ ingredientId: '', quantity: 1 });
  }

  removeIngredient(index: number): void {
    this.selectedIngredients.splice(index, 1);
  }

  // Cálculo de costo por ingrediente
  getIngredientCost(sel: { ingredientId: string; quantity: number }): number {
    const ing = this.ingredients.find(i => i.id === sel.ingredientId);
    if (!ing) return 0;
    // costo unitario por unidad = unitValue / packageSize
    const costPerUnit = ing.unitValue / ing.packageSize;
    return costPerUnit * sel.quantity;
  }

  // Suma total de ingredientes
  sumIngredientsCost(): number {
    return this.selectedIngredients.reduce((sum, sel) => sum + this.getIngredientCost(sel), 0);
  }

  // Obtiene la unidad de un ingrediente por su ID
  getIngredientUnit(ingredientId: string | undefined): string {
    const ing = this.ingredients.find(i => i.id === ingredientId);
    return ing?.unit || '';
  }

  /** Devuelve el ingrediente completo según su id */
  getIngredientById(id: string | undefined): Ingredient | undefined {
    return this.ingredients.find(i => i.id === id);
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
    this.openIngModal = true;
  }

  closeIngredientsModal(): void {
    this.openIngModal = false;
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
    const laborH = this.evaluateExpression(calc.labor.hours) || 0;
    const laborM = this.evaluateExpression(calc.labor.minutes) || 0;
    const laborTotal = laborH + laborM / 60;
    const laborCost = laborTotal * 34.85;
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