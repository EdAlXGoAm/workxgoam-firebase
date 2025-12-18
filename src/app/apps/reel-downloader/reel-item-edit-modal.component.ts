import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ZonayummyReelHistoryItem, ZonayummyFolder, ZonayummyLabel, ZonayummyReelHistoryService } from './zonayummy-reel-history.service';

@Component({
  selector: 'app-reel-item-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      *ngIf="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      (click)="close()"
    >
      <div
        class="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
        (click)="$event.stopPropagation()"
      >
        <!-- Header -->
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-lg text-gray-900">Editar descarga</h3>
          <button
            class="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            (click)="close()"
          >×</button>
        </div>

        <!-- Info del item -->
        <div class="bg-gray-50 rounded-xl p-3 mb-4">
          <div class="text-xs text-gray-500 mb-1">{{ item?.platform | uppercase }}</div>
          <div class="text-sm text-gray-800 break-all line-clamp-2">{{ item?.url }}</div>
        </div>

        <!-- Título -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Título (opcional)</label>
          <input
            type="text"
            [(ngModel)]="editTitle"
            class="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Nombre personalizado..."
          />
        </div>

        <!-- Descripción -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea
            [(ngModel)]="editDescription"
            rows="2"
            class="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            placeholder="Agrega una descripción..."
          ></textarea>
        </div>

        <!-- Carpeta -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Carpeta</label>
          <select
            [(ngModel)]="editFolderId"
            class="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
          >
            <option [ngValue]="null">Sin carpeta (raíz)</option>
            <option *ngFor="let f of folders" [ngValue]="f.id">
              {{ f.icon || '📁' }} {{ f.name }}
            </option>
          </select>
          <button
            type="button"
            class="mt-2 text-sm text-indigo-600 hover:text-indigo-800"
            (click)="showNewFolderInput = !showNewFolderInput"
          >
            + Nueva carpeta
          </button>
          <div *ngIf="showNewFolderInput" class="mt-2 flex gap-2">
            <input
              type="text"
              [(ngModel)]="newFolderName"
              class="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm"
              placeholder="Nombre de carpeta..."
              (keyup.enter)="createNewFolder()"
            />
            <button
              type="button"
              class="px-3 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium"
              (click)="createNewFolder()"
              [disabled]="!newFolderName.trim() || creatingFolder"
            >
              {{ creatingFolder ? '...' : 'Crear' }}
            </button>
          </div>
        </div>

        <!-- Etiquetas -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Etiquetas</label>
          
          <!-- Tags seleccionados -->
          <div class="flex flex-wrap gap-1 mb-2" *ngIf="selectedLabels.length > 0">
            <span
              *ngFor="let label of selectedLabels"
              class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
              [style.backgroundColor]="label.color"
              [style.color]="getContrastColor(label.color)"
            >
              {{ label.name }}
              <button
                type="button"
                class="ml-1 hover:opacity-70"
                (click)="removeLabel(label)"
              >×</button>
            </span>
          </div>

          <!-- Input para nuevas etiquetas -->
          <div class="relative">
            <input
              type="text"
              [(ngModel)]="labelInput"
              class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Escribe y presiona coma para agregar..."
              (keydown)="onLabelKeydown($event)"
            />
          </div>

          <!-- Sugerencias de etiquetas existentes -->
          <div class="flex flex-wrap gap-1 mt-2" *ngIf="suggestedLabels.length > 0">
            <button
              *ngFor="let label of suggestedLabels"
              type="button"
              class="px-2 py-1 rounded-full text-xs font-medium border border-dashed transition hover:border-solid"
              [style.borderColor]="label.color"
              [style.color]="label.color"
              (click)="addLabel(label)"
            >
              + {{ label.name }}
            </button>
          </div>
        </div>

        <!-- Error -->
        <div *ngIf="error" class="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {{ error }}
        </div>

        <!-- Acciones -->
        <div class="flex gap-3 mt-6">
          <button
            type="button"
            class="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition"
            (click)="close()"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition flex items-center justify-center gap-2"
            (click)="save()"
            [disabled]="saving"
          >
            <svg *ngIf="saving" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            {{ saving ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ReelItemEditModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() item: ZonayummyReelHistoryItem | null = null;
  @Input() folders: ZonayummyFolder[] = [];
  @Input() labels: ZonayummyLabel[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<ZonayummyReelHistoryItem>();
  @Output() folderCreated = new EventEmitter<ZonayummyFolder>();
  @Output() labelsCreated = new EventEmitter<ZonayummyLabel[]>();

  editTitle = '';
  editDescription = '';
  editFolderId: string | null = null;
  selectedLabels: ZonayummyLabel[] = [];
  labelInput = '';

  showNewFolderInput = false;
  newFolderName = '';
  creatingFolder = false;

  saving = false;
  error = '';

  constructor(private historyService: ZonayummyReelHistoryService) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isOpen'] && this.isOpen && this.item) {
      // Inicializar valores
      this.editTitle = this.item.title || '';
      this.editDescription = this.item.description || '';
      this.editFolderId = this.item.folderId || null;
      this.selectedLabels = this.labels.filter(l => this.item?.labelIds?.includes(l.id));
      this.labelInput = '';
      this.error = '';
      this.showNewFolderInput = false;
      this.newFolderName = '';
    }
  }

  get suggestedLabels(): ZonayummyLabel[] {
    const selectedIds = new Set(this.selectedLabels.map(l => l.id));
    return this.labels.filter(l => !selectedIds.has(l.id)).slice(0, 6);
  }

  close() {
    this.closed.emit();
  }

  addLabel(label: ZonayummyLabel) {
    if (!this.selectedLabels.find(l => l.id === label.id)) {
      this.selectedLabels = [...this.selectedLabels, label];
    }
  }

  removeLabel(label: ZonayummyLabel) {
    this.selectedLabels = this.selectedLabels.filter(l => l.id !== label.id);
  }

  onLabelKeydown(event: KeyboardEvent) {
    if (event.key === ',' || event.key === 'Enter') {
      event.preventDefault();
      const name = this.labelInput.trim().replace(/,/g, '');
      if (name) {
        this.createAndAddLabel(name);
      }
    }
  }

  async createAndAddLabel(name: string) {
    // Verificar si ya existe
    const existing = this.labels.find(l => l.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      this.addLabel(existing);
      this.labelInput = '';
      return;
    }

    // Crear nueva etiqueta
    const result = await this.historyService.createLabel({ name });
    if (result.ok) {
      this.addLabel(result.label);
      if (!result.existed) {
        this.labelsCreated.emit([result.label]);
      }
    }
    this.labelInput = '';
  }

  async createNewFolder() {
    if (!this.newFolderName.trim()) return;
    this.creatingFolder = true;

    const result = await this.historyService.createFolder({ name: this.newFolderName.trim() });
    if (result.ok) {
      this.folderCreated.emit(result.folder);
      this.editFolderId = result.folder.id;
      this.showNewFolderInput = false;
      this.newFolderName = '';
    } else {
      this.error = result.error;
    }

    this.creatingFolder = false;
  }

  async save() {
    if (!this.item) return;
    this.saving = true;
    this.error = '';

    const updates: any = {};
    
    if (this.editTitle !== (this.item.title || '')) {
      updates.title = this.editTitle || null;
    }
    if (this.editDescription !== (this.item.description || '')) {
      updates.description = this.editDescription || null;
    }
    if (this.editFolderId !== (this.item.folderId || null)) {
      updates.folderId = this.editFolderId;
    }
    
    const newLabelIds = this.selectedLabels.map(l => l.id);
    const oldLabelIds = this.item.labelIds || [];
    if (JSON.stringify(newLabelIds.sort()) !== JSON.stringify([...oldLabelIds].sort())) {
      updates.labelIds = newLabelIds;
    }

    if (Object.keys(updates).length === 0) {
      // Sin cambios
      this.close();
      return;
    }

    const result = await this.historyService.updateItem(this.item.id, updates);
    if (result.ok) {
      this.saved.emit(result.item);
      this.close();
    } else {
      this.error = result.error;
    }

    this.saving = false;
  }

  getContrastColor(hexColor: string): string {
    if (!hexColor || !hexColor.startsWith('#')) return '#000000';
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#374151' : '#ffffff';
  }
}

