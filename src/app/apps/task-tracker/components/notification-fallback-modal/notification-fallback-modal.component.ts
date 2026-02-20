import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-notification-fallback-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-fallback-modal.component.html',
  styleUrls: ['./notification-fallback-modal.component.css']
})
export class NotificationFallbackModalComponent {
  @Input() visible = false;
  @Input() localLoading = false;

  @Output() close = new EventEmitter<void>();
  @Output() enableLocalOnly = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }

  onEnableLocalOnly(): void {
    this.enableLocalOnly.emit();
  }
}
