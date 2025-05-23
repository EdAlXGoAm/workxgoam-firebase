import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Print3DCalculationService, Print3DCostItem, Print3DCalculation } from '../../services/print3d-calculation.service';
import Chart from 'chart.js/auto';
import { Storage, ref, uploadString, getDownloadURL } from '@angular/fire/storage';

interface CalculatedSummary {
  id?: string;
  title: string;
  images: string[];
  filamentCost: number;
  totalCost: number;
  merchantPrice: number;
  publicPrice: number;
  myProfit: number;
  merchantProfit: number;
  currentImageIndex: number;
}

@Component({
  selector: 'app-calculadora-3d',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calculadora-3d.component.html',
  styles: [`
    /* Estilos para el slider de imágenes */
    .image-slider {
      position: relative;
      overflow: hidden;
      border-radius: 8px;
      background-color: #f3f4f6;
      touch-action: pan-x;
    }
    
    .image-slider-container {
      display: flex;
      transition: transform 0.3s ease;
      width: 100%;
    }
    
    .slider-image {
      min-width: 100%;
      height: 200px;
      object-fit: cover;
      user-select: none;
    }
    
    .slider-controls {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(0, 0, 0, 0.5);
      color: white;
      border: none;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 12px;
      z-index: 10;
    }
    
    .slider-controls:hover {
      background: rgba(0, 0, 0, 0.7);
    }
    
    .slider-prev {
      left: 8px;
    }
    
    .slider-next {
      right: 8px;
    }
    
    .slider-dots {
      position: absolute;
      bottom: 8px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 4px;
      z-index: 10;
    }
    
    .slider-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.5);
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .slider-dot.active {
      background: white;
    }
    
    .no-images-placeholder {
      height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f9fafb;
      color: #6b7280;
      font-size: 14px;
      border-radius: 8px;
    }

    /* Modal de zoom */
    .zoom-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 20px;
    }
    
    .zoom-image {
      max-width: 90vw;
      max-height: 90vh;
      object-fit: contain;
      cursor: zoom-out;
    }
    
    .zoom-close {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 18px;
    }
  `]
})
export class Calculadora3DComponent implements OnInit, AfterViewInit {
  // ID del cálculo actualmente cargado (null si es nuevo)
  currentLoadedId: string | null = null;
  
  // Lista de cálculos guardados
  savedCalculations: Print3DCalculation[] = [];

  // Información de impresión
  weightGrams = '';
  printHours = '';
  printMinutes = '';
  pieces = '1';

  // Mano de obra
  laborHours = '';
  laborMinutes = '';

  // Opciones avanzadas
  filamentCostPerKg = '379'; // Valor por defecto del script
  electricityRatePerHour = '3.80';
  printerDepreciationPerMinute = '0.02';
  laborRatePerHour = '50';
  forcedCostForFactors = '';
  
  // Costos adicionales
  additionalCosts: Print3DCostItem[] = [];

  // Resultados
  resultFilamentCost = 0;
  resultElectricityCost = 0;
  resultDepreciationCost = 0;
  resultLaborCost = 0;
  resultAdditionalCost = 0;
  resultTotalCost = 0;
  resultMerchantFactor = 0;
  resultPublicFactor = 0;
  resultMerchantPrice = 0;
  resultPublicPrice = 0;
  resultMyProfit = 0;
  resultMerchantProfit = 0;

  // Gráficas
  @ViewChild('merchantFactorChartCanvas') merchantChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('publicFactorChartCanvas') publicChartRef!: ElementRef<HTMLCanvasElement>;
  merchantFactorChart!: Chart;
  publicFactorChart!: Chart;

  // Extra info
  calculationTitle = '';
  calculationLinksText = '';
  images: (string | null)[] = [null, null, null]; // Data URLs para edición local
  imageUrls: string[] = []; // URLs de Firebase Storage para mostrar
  currentImageIndex = 0;
  modalVisible = false;

  // Estado de modal de comparar cálculos
  isCompareModalVisible = false;
  compareSummaries: { title: string; totalCost: number; merchantPrice: number; publicPrice: number }[] = [];

  // Estados para comparador publicitario
  isAdvertisingComparatorVisible = false;
  advertisingCalculations: CalculatedSummary[] = [];
  zoomModalVisible = false;
  zoomImageSrc = '';

  constructor(
    private print3dService: Print3DCalculationService,
    private storage: Storage
  ) {}

  ngOnInit(): void {
    // Inicialización básica
    this.addAdditionalCost();
    this.print3dService.getCalculations().subscribe(calcs => this.savedCalculations = calcs);
  }

  ngAfterViewInit(): void {
    this.initializeCharts(0);
  }

  // Métodos de costos adicionales
  addAdditionalCost(): void {
    this.additionalCosts.push({ description: '', value: '' });
  }

  removeAdditionalCost(index: number): void {
    this.additionalCosts.splice(index, 1);
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

  sumAdditionalCosts(): number {
    return this.additionalCosts.reduce((sum, c) => {
      try {
        return sum + this.evaluateExpression(c.value);
      } catch {
        return sum;
      }
    }, 0);
  }

  // Método para calcular valores de un cálculo específico
  private calculateValuesForCalculation(calc: Print3DCalculation): CalculatedSummary {
    try {
      // Obtener valores
      const weight = this.evaluateExpression(calc.printInfo.weightGrams);
      const printH = this.evaluateExpression(calc.printInfo.printHours) || 0;
      const printM = this.evaluateExpression(calc.printInfo.printMinutes) || 0;
      const numPieces = Math.max(1, this.evaluateExpression(calc.printInfo.pieces) || 1);
      
      // Tiempo total de impresión en horas
      const totalPrintTime = printH + printM / 60;
      
      // Mano de obra
      const laborH = this.evaluateExpression(calc.laborInfo.hours) || 0;
      const laborM = this.evaluateExpression(calc.laborInfo.minutes) || 0;
      const totalLaborTime = laborH + laborM / 60;
      
      // Costos por pieza
      const weightPerPiece = weight / numPieces;
      const timePerPiece = totalPrintTime / numPieces;
      const laborPerPiece = totalLaborTime / numPieces;
      
      // Opciones avanzadas
      const filamentCost = this.evaluateExpression(calc.advancedOptions.filamentCostPerKg);
      const electricityRate = this.evaluateExpression(calc.advancedOptions.electricityRatePerHour);
      const depreciationRate = this.evaluateExpression(calc.advancedOptions.printerDepreciationPerMinute);
      const laborRate = this.evaluateExpression(calc.advancedOptions.laborRatePerHour);
      
      // Cálculos principales
      const resultFilamentCost = this.print3dService.calculateFilamentCost(weightPerPiece, filamentCost);
      const resultElectricityCost = this.print3dService.calculateElectricityCost(timePerPiece, electricityRate);
      const resultDepreciationCost = this.print3dService.calculateDepreciationCost(timePerPiece, depreciationRate);
      const resultLaborCost = this.print3dService.calculateLaborCost(laborPerPiece, laborRate);
      const resultAdditionalCost = calc.additionalCosts.reduce((sum, c) => {
        try {
          return sum + this.evaluateExpression(c.value);
        } catch {
          return sum;
        }
      }, 0);
      
      // Costo total
      const resultTotalCost = resultFilamentCost + resultElectricityCost + 
                             resultDepreciationCost + resultLaborCost + resultAdditionalCost;
      
      // Usar costo forzado si se especifica
      let costForFactors = resultTotalCost;
      if (calc.advancedOptions.forcedCostForFactors.trim()) {
        costForFactors = this.evaluateExpression(calc.advancedOptions.forcedCostForFactors);
      }
      
      // Calcular factores y precios
      const resultMerchantFactor = this.print3dService.calculateMerchantFactor(costForFactors);
      const merchantPriceRaw = resultTotalCost * resultMerchantFactor;
      const resultMerchantPrice = this.print3dService.roundMerchantPrice(merchantPriceRaw);
      
      const resultPublicFactor = this.print3dService.calculatePublicFactor(resultMerchantPrice, costForFactors);
      const publicPriceRaw = resultMerchantPrice * (1 + resultPublicFactor);
      const resultPublicPrice = this.print3dService.roundPublicPrice(publicPriceRaw);
      
      // Ganancias
      const resultMyProfit = resultMerchantPrice - resultTotalCost;
      const resultMerchantProfit = resultPublicPrice - resultMerchantPrice;

      return {
        id: calc.id,
        title: calc.title,
        images: calc.images || [],
        filamentCost: resultFilamentCost,
        totalCost: resultTotalCost,
        merchantPrice: resultMerchantPrice,
        publicPrice: resultPublicPrice,
        myProfit: resultMyProfit,
        merchantProfit: resultMerchantProfit,
        currentImageIndex: 0
      };
    } catch {
      return {
        id: calc.id,
        title: calc.title,
        images: calc.images || [],
        filamentCost: 0,
        totalCost: 0,
        merchantPrice: 0,
        publicPrice: 0,
        myProfit: 0,
        merchantProfit: 0,
        currentImageIndex: 0
      };
    }
  }

  calculatePrices(): void {
    try {
      // Validar inputs básicos
      const weight = this.evaluateExpression(this.weightGrams);
      const printH = this.evaluateExpression(this.printHours) || 0;
      const printM = this.evaluateExpression(this.printMinutes) || 0;
      const numPieces = Math.max(1, this.evaluateExpression(this.pieces) || 1);
      
      // Tiempo total de impresión en horas
      const totalPrintTime = printH + printM / 60;
      
      // Mano de obra
      const laborH = this.evaluateExpression(this.laborHours) || 0;
      const laborM = this.evaluateExpression(this.laborMinutes) || 0;
      const totalLaborTime = laborH + laborM / 60;
      
      // Costos por pieza
      const weightPerPiece = weight / numPieces;
      const timePerPiece = totalPrintTime / numPieces;
      const laborPerPiece = totalLaborTime / numPieces;
      
      // Opciones avanzadas
      const filamentCost = this.evaluateExpression(this.filamentCostPerKg);
      const electricityRate = this.evaluateExpression(this.electricityRatePerHour);
      const depreciationRate = this.evaluateExpression(this.printerDepreciationPerMinute);
      const laborRate = this.evaluateExpression(this.laborRatePerHour);
      
      // Cálculos principales basados en el script de Python
      this.resultFilamentCost = this.print3dService.calculateFilamentCost(weightPerPiece, filamentCost);
      this.resultElectricityCost = this.print3dService.calculateElectricityCost(timePerPiece, electricityRate);
      this.resultDepreciationCost = this.print3dService.calculateDepreciationCost(timePerPiece, depreciationRate);
      this.resultLaborCost = this.print3dService.calculateLaborCost(laborPerPiece, laborRate);
      this.resultAdditionalCost = this.sumAdditionalCosts();
      
      // Costo total
      this.resultTotalCost = this.resultFilamentCost + this.resultElectricityCost + 
                           this.resultDepreciationCost + this.resultLaborCost + this.resultAdditionalCost;
      
      // Usar costo forzado si se especifica
      let costForFactors = this.resultTotalCost;
      if (this.forcedCostForFactors.trim()) {
        costForFactors = this.evaluateExpression(this.forcedCostForFactors);
      }
      
      // Calcular factores y precios
      this.resultMerchantFactor = this.print3dService.calculateMerchantFactor(costForFactors);
      const merchantPriceRaw = this.resultTotalCost * this.resultMerchantFactor;
      this.resultMerchantPrice = this.print3dService.roundMerchantPrice(merchantPriceRaw);
      
      this.resultPublicFactor = this.print3dService.calculatePublicFactor(this.resultMerchantPrice, costForFactors);
      const publicPriceRaw = this.resultMerchantPrice * (1 + this.resultPublicFactor);
      this.resultPublicPrice = this.print3dService.roundPublicPrice(publicPriceRaw);
      
      // Ganancias
      this.resultMyProfit = this.resultMerchantPrice - this.resultTotalCost;
      this.resultMerchantProfit = this.resultPublicPrice - this.resultMerchantPrice;
      
      // Actualizar gráficas
      this.updateCharts(this.resultTotalCost, costForFactors);
      
    } catch (e: any) {
      alert('Error en el cálculo: ' + e.message);
    }
  }

  initializeCharts(baseCost: number): void {
    if (this.merchantChartRef && this.publicChartRef) {
      const ctx1 = this.merchantChartRef.nativeElement.getContext('2d');
      const ctx2 = this.publicChartRef.nativeElement.getContext('2d');
      
      if (ctx1 && ctx2) {
        this.merchantFactorChart = new Chart(ctx1, {
          type: 'line',
          data: { labels: [], datasets: [] },
          options: { responsive: true, plugins: { title: { display: true, text: 'Factor para Comerciante' } } }
        });
        
        this.publicFactorChart = new Chart(ctx2, {
          type: 'line',
          data: { labels: [], datasets: [] },
          options: { responsive: true, plugins: { title: { display: true, text: 'Factor para Público' } } }
        });
      }
    }
  }

  updateCharts(baseCost: number, forcedCost: number | null = null): void {
    const range = 50;
    const steps = 100;
    const startCost = Math.max(0, baseCost - range);
    const endCost = baseCost + range;
    const stepSize = (endCost - startCost) / steps;
    
    const labels: string[] = [];
    const merchantFactors: number[] = [];
    const publicFactors: number[] = [];
    
    for (let i = 0; i <= steps; i++) {
      const cost = startCost + i * stepSize;
      const costForFactors = forcedCost !== null ? forcedCost : cost;
      
      labels.push(cost.toFixed(1));
      merchantFactors.push(this.print3dService.calculateMerchantFactor(costForFactors));
      
      const tempMerchantPrice = cost * this.print3dService.calculateMerchantFactor(costForFactors);
      publicFactors.push(this.print3dService.calculatePublicFactor(tempMerchantPrice, costForFactors));
    }
    
    // Actualizar gráfica de factor comerciante
    this.merchantFactorChart.data.labels = labels;
    this.merchantFactorChart.data.datasets = [{
      label: 'Factor Comerciante',
      data: merchantFactors,
      borderColor: 'rgb(99, 102, 241)',
      backgroundColor: 'rgba(99, 102, 241, 0.2)',
      tension: 0.1
    }];
    this.merchantFactorChart.update();
    
    // Actualizar gráfica de factor público
    this.publicFactorChart.data.labels = labels;
    this.publicFactorChart.data.datasets = [{
      label: 'Factor Público',
      data: publicFactors,
      borderColor: 'rgb(139, 92, 246)',
      backgroundColor: 'rgba(139, 92, 246, 0.2)',
      tension: 0.1
    }];
    this.publicFactorChart.update();
  }

  async saveCalculation(): Promise<void> {
    if (!this.calculationTitle.trim()) {
      alert('Por favor ingrese un título para el cálculo.');
      return;
    }

    const links = this.calculationLinksText.split('\n').filter(link => link.trim() !== '');

    const calculation: Omit<Print3DCalculation, 'id' | 'userId' | 'createdAt'> = {
      title: this.calculationTitle,
      links,
      printInfo: {
        weightGrams: this.weightGrams,
        printHours: this.printHours,
        printMinutes: this.printMinutes,
        pieces: this.pieces
      },
      laborInfo: {
        hours: this.laborHours,
        minutes: this.laborMinutes
      },
      advancedOptions: {
        filamentCostPerKg: this.filamentCostPerKg,
        electricityRatePerHour: this.electricityRatePerHour,
        printerDepreciationPerMinute: this.printerDepreciationPerMinute,
        laborRatePerHour: this.laborRatePerHour,
        forcedCostForFactors: this.forcedCostForFactors,
        additionalCosts: this.sumAdditionalCosts().toString()
      },
      additionalCosts: this.additionalCosts,
      images: [] // Se manejará en el servicio
    };

    try {
      if (this.currentLoadedId) {
        // Actualizar cálculo existente
        const hasNewImages = this.images.some(img => img !== null);
        await this.print3dService.updateCalculation(
          this.currentLoadedId, 
          calculation,
          hasNewImages ? this.images : undefined
        );
        alert('Cálculo actualizado exitosamente');
      } else {
        // Crear nuevo cálculo
        const id = await this.print3dService.addCalculation(calculation, this.images);
        if (id) {
          this.currentLoadedId = id;
          alert('Cálculo guardado exitosamente');
          // Limpiar las imágenes locales ya que ahora están en Storage
          this.images = [null, null, null];
          // Recargar para obtener las URLs de Storage
          this.print3dService.getCalculations().subscribe(calcs => {
            const savedCalc = calcs.find(c => c.id === id);
            if (savedCalc) {
              this.imageUrls = savedCalc.images;
            }
          });
        }
      }
    } catch (error) {
      alert('Error al guardar el cálculo');
    }
  }

  async editCalculation(): Promise<void> {
    if (!this.currentLoadedId) {
      alert('No hay un cálculo cargado para editar.');
      return;
    }
    await this.saveCalculation();
  }

  loadCalculation(calc: Print3DCalculation): void {
    this.currentLoadedId = calc.id || null;
    this.calculationTitle = calc.title;
    this.calculationLinksText = calc.links.join('\n');
    
    // Cargar información de impresión
    this.weightGrams = calc.printInfo.weightGrams;
    this.printHours = calc.printInfo.printHours;
    this.printMinutes = calc.printInfo.printMinutes;
    this.pieces = calc.printInfo.pieces;
    
    // Cargar información de mano de obra
    this.laborHours = calc.laborInfo.hours;
    this.laborMinutes = calc.laborInfo.minutes;
    
    // Cargar opciones avanzadas
    this.filamentCostPerKg = calc.advancedOptions.filamentCostPerKg;
    this.electricityRatePerHour = calc.advancedOptions.electricityRatePerHour;
    this.printerDepreciationPerMinute = calc.advancedOptions.printerDepreciationPerMinute;
    this.laborRatePerHour = calc.advancedOptions.laborRatePerHour;
    this.forcedCostForFactors = calc.advancedOptions.forcedCostForFactors;
    
    // Cargar costos adicionales
    this.additionalCosts = [...calc.additionalCosts];
    
    // Cargar URLs de imágenes de Storage
    this.imageUrls = calc.images || [];
    this.images = [null, null, null]; // Limpiar imágenes locales
    
    // Recalcular
    this.calculatePrices();
  }

  async deleteSavedCalculation(calc: Print3DCalculation): Promise<void> {
    if (confirm('¿Está seguro de que desea eliminar este cálculo?')) {
      if (calc.id) {
        await this.print3dService.deleteCalculation(calc.id);
        if (this.currentLoadedId === calc.id) {
          this.currentLoadedId = null;
        }
      }
    }
  }

  // Métodos para manejo de imágenes
  handleImageClick(index: number): void {
    // Si hay imagen local (data URL) o imagen de Storage (URL), mostrar modal
    const hasLocalImage = this.images[index] !== null;
    const hasStorageImage = this.imageUrls[index];
    
    if (hasLocalImage || hasStorageImage) {
      this.currentImageIndex = index;
      this.modalVisible = true;
    } else {
      this.pasteImage(index);
    }
  }

  pasteImage(index: number): void {
    navigator.clipboard.read().then(clipboardItems => {
      for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
          if (type.startsWith('image/')) {
            clipboardItem.getType(type).then(blob => {
              const reader = new FileReader();
              reader.onload = (e) => {
                this.images[index] = e.target?.result as string;
                // Limpiar la URL de Storage si existe para mostrar la nueva imagen
                if (this.imageUrls[index]) {
                  this.imageUrls = [...this.imageUrls];
                  this.imageUrls[index] = '';
                }
              };
              reader.readAsDataURL(blob);
            });
            return;
          }
        }
      }
      alert('No se encontró una imagen en el portapapeles');
    }).catch(() => {
      alert('Error al acceder al portapapeles');
    });
  }

  closeModal(): void {
    this.modalVisible = false;
  }

  removeCurrentImage(): void {
    this.images[this.currentImageIndex] = null;
    if (this.imageUrls[this.currentImageIndex]) {
      this.imageUrls = [...this.imageUrls];
      this.imageUrls[this.currentImageIndex] = '';
    }
    this.closeModal();
  }

  // Método para obtener la URL de imagen a mostrar (local o Storage)
  getImageToShow(index: number): string | null {
    // Priorizar imagen local sobre imagen de Storage
    return this.images[index] || this.imageUrls[index] || null;
  }

  // Modal de comparación básico
  openCompareModal(): void {
    this.compareSummaries = this.savedCalculations.map(calc => {
      const calculated = this.calculateValuesForCalculation(calc);
      return {
        title: calc.title,
        totalCost: calculated.totalCost,
        merchantPrice: calculated.merchantPrice,
        publicPrice: calculated.publicPrice
      };
    });
    this.isCompareModalVisible = true;
  }

  closeCompareModal(): void {
    this.isCompareModalVisible = false;
  }

  // Métodos para el comparador publicitario
  openAdvertisingComparator(): void {
    this.advertisingCalculations = this.savedCalculations.map(calc => 
      this.calculateValuesForCalculation(calc)
    );
    this.isAdvertisingComparatorVisible = true;
  }

  closeAdvertisingComparator(): void {
    this.isAdvertisingComparatorVisible = false;
  }

  // Métodos para el slider de imágenes
  changeSlideImage(calcIndex: number, direction: 'prev' | 'next'): void {
    const calc = this.advertisingCalculations[calcIndex];
    if (!calc.images.length) return;

    if (direction === 'prev') {
      calc.currentImageIndex = calc.currentImageIndex === 0 
        ? calc.images.length - 1 
        : calc.currentImageIndex - 1;
    } else {
      calc.currentImageIndex = calc.currentImageIndex === calc.images.length - 1 
        ? 0 
        : calc.currentImageIndex + 1;
    }
  }

  goToSlideImage(calcIndex: number, imageIndex: number): void {
    this.advertisingCalculations[calcIndex].currentImageIndex = imageIndex;
  }

  // Métodos para el zoom de imágenes
  openImageZoom(imageSrc: string): void {
    this.zoomImageSrc = imageSrc;
    this.zoomModalVisible = true;
  }

  closeImageZoom(): void {
    this.zoomModalVisible = false;
    this.zoomImageSrc = '';
  }

  // Método para manejar swipe en dispositivos móviles
  onSliderTouchStart(event: TouchEvent, calcIndex: number): void {
    const calc = this.advertisingCalculations[calcIndex];
    if (!calc.images.length) return;

    const touch = event.touches[0];
    (calc as any).touchStartX = touch.clientX;
  }

  onSliderTouchEnd(event: TouchEvent, calcIndex: number): void {
    const calc = this.advertisingCalculations[calcIndex];
    if (!calc.images.length || !(calc as any).touchStartX) return;

    const touch = event.changedTouches[0];
    const touchEndX = touch.clientX;
    const touchStartX = (calc as any).touchStartX;
    const diff = touchStartX - touchEndX;

    // Mínima distancia para considerar un swipe
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        // Swipe izquierda - siguiente imagen
        this.changeSlideImage(calcIndex, 'next');
      } else {
        // Swipe derecha - imagen anterior
        this.changeSlideImage(calcIndex, 'prev');
      }
    }

    delete (calc as any).touchStartX;
  }
} 