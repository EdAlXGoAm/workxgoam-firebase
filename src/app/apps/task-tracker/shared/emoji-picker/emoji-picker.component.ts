import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EMOJI_CATEGORIES, EMOJI_KEYWORDS } from '../emoji-data';

@Component({
  selector: 'app-emoji-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './emoji-picker.component.html',
  styleUrls: ['./emoji-picker.component.css']
})
export class EmojiPickerComponent implements OnInit {
  @Input() currentEmoji: string = '📝';
  @Input() suggestedEmojis: string[] = [];
  @Input() title: string = 'Seleccionar Emoji';
  @Input() subtitle: string = '';
  @Input() showModal: boolean = true;
  
  @Output() emojiSelected = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();
  
  emojiCategories = EMOJI_CATEGORIES;
  emojiKeywords = EMOJI_KEYWORDS;
  
  searchQuery: string = '';
  filteredEmojis: string[] = [];
  selectedCategoryIndex: number = 0;
  
  ngOnInit(): void {
    // Inicializar con la categoría de "Frecuentes"
    this.selectedCategoryIndex = 0;
  }
  
  onSearch(query: string): void {
    this.searchQuery = query;
    if (!query.trim()) {
      this.filteredEmojis = [];
      return;
    }
    this.filteredEmojis = this.searchEmojis(query);
  }
  
  private searchEmojis(query: string): string[] {
    const searchLower = query.toLowerCase().trim();
    const results: string[] = [];
    const seen = new Set<string>();
    
    // Buscar en keywords
    for (const [emoji, keywords] of Object.entries(this.emojiKeywords)) {
      if (keywords.some(k => k.toLowerCase().includes(searchLower))) {
        if (!seen.has(emoji)) {
          results.push(emoji);
          seen.add(emoji);
        }
      }
    }
    
    return results;
  }
  
  selectCategory(index: number): void {
    this.selectedCategoryIndex = index;
    this.searchQuery = '';
    this.filteredEmojis = [];
  }
  
  selectEmoji(emoji: string): void {
    this.emojiSelected.emit(emoji);
  }
  
  close(): void {
    this.closed.emit();
  }
  
  onBackdropClick(): void {
    this.close();
  }
  
  onModalClick(event: Event): void {
    event.stopPropagation();
  }
}
