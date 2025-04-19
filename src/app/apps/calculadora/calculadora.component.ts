import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CostCalculationService, CostItem, CostCalculation } from '../../services/cost-calculation.service';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-calculadora',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calculadora.component.html',
  styles: []
})
export class CalculadoraComponent implements OnInit, AfterViewInit {
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

  constructor(private calcService: CostCalculationService) {}

  ngOnInit(): void {
    // Agregar item inicial
    this.addCostWithoutProfit();
    this.addCostWithProfit();
    // Suscripción a cálculos guardados
    this.calcService.getCalculations()
      .subscribe(calcs => this.savedCalculations = calcs);
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

  // Guardar cálculo
  async saveCalculation(): Promise<void> {
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
      images: this.images.filter(img => img !== null) as string[]
    };

    const id = await this.calcService.addCalculation(calculation);
    if (id) {
      alert('Cálculo guardado correctamente');
    } else {
      alert('No se pudo guardar el cálculo');
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
    this.calculatePrices();
  }

  // Eliminar un cálculo guardado
  deleteSavedCalculation(calc: CostCalculation): void {
    if (!calc.id) return;
    this.calcService.deleteCalculation(calc.id)
      .then(success => {
        if (!success) {
          alert('No se pudo eliminar el cálculo');
        }
      });
  }
} 