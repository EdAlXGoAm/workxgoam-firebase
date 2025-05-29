import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface SubscriptionFormData {
  id: string | null;
  name: string;
  emoji: string;
  cost: number;
  currency: string;
  startDate: string;
  endDate: string;
  isRecurring: boolean;
  category: string;
}

@Component({
  selector: 'app-subscription-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subscription-form-modal.component.html',
  styleUrls: ['./subscription-form-modal.component.css']
})
export class SubscriptionFormModalComponent implements OnInit, OnChanges {
  @Input() isVisible: boolean = false;
  @Input() isEditing: boolean = false;
  @Input() subscriptionData: SubscriptionFormData | null = null;
  
  @Output() onSubmit = new EventEmitter<SubscriptionFormData>();
  @Output() onClose = new EventEmitter<void>();

  // Lista de emojis disponibles
  availableEmojis: string[] = [
    '📱', '💻', '🎮', '🎬', '🎵', '📺', '📚', '🏋️', '🎨', '🎲', 
    '☁️', '📝', '🎓', '🔍', '🛍️', '🏠', '🍿', '🎧', '📰', '📷',
    '🎭', '🚗', '✈️', '🏦', '💼', '🛒', '🎟️', '🍔', '☕', '🍕'
  ];

  showEmojiPicker: boolean = false;

  subscriptionForm: SubscriptionFormData = {
    id: null,
    name: '',
    emoji: '📱',
    cost: 0,
    currency: 'MXN',
    startDate: '',
    endDate: '',
    isRecurring: false,
    category: 'entertainment'
  };

  ngOnInit(): void {
    this.resetForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['subscriptionData'] && this.subscriptionData) {
      this.subscriptionForm = { ...this.subscriptionData };
    }
    if (changes['isVisible'] && !this.isVisible) {
      this.showEmojiPicker = false;
    }
  }

  selectEmoji(emoji: string): void {
    this.subscriptionForm.emoji = emoji;
    this.showEmojiPicker = false;
  }

  toggleEmojiPicker(): void {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  resetForm(): void {
    this.subscriptionForm = {
      id: null,
      name: '',
      emoji: '📱',
      cost: 0,
      currency: 'MXN',
      startDate: '',
      endDate: '',
      isRecurring: false,
      category: 'entertainment'
    };
    this.showEmojiPicker = false;
  }

  onSubmitForm(): void {
    if (!this.subscriptionForm.name || this.subscriptionForm.cost <= 0 || !this.subscriptionForm.startDate) {
      return;
    }
    this.onSubmit.emit({ ...this.subscriptionForm });
  }

  closeModal(): void {
    this.showEmojiPicker = false;
    this.onClose.emit();
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }
} 