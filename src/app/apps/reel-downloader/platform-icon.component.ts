import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

let platformIconSeq = 0;

@Component({
  selector: 'app-platform-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    @switch (platform) {
      @case ('instagram') {
        <svg class="platform-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
          <defs>
            <linearGradient [attr.id]="igGradId" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#feda75"/>
              <stop offset="25%" stop-color="#fa7e1e"/>
              <stop offset="50%" stop-color="#d62976"/>
              <stop offset="75%" stop-color="#962fbf"/>
              <stop offset="100%" stop-color="#4f5bd5"/>
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="5" [attr.fill]="'url(#' + igGradId + ')'"/>
          <circle cx="12" cy="12" r="4.2" fill="none" stroke="#fff" stroke-width="1.8"/>
          <circle cx="17.4" cy="6.6" r="1.2" fill="#fff"/>
        </svg>
      }
      @case ('tiktok') {
        <svg class="platform-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#25F4EE" d="M15.5 3.5c.2 1.8 1.2 3.4 2.8 4.3V9.8c-1.1 0-2.1-.3-3-.8v6.9a5.1 5.1 0 1 1-4.4-5.05v2.35a2.75 2.75 0 1 0 1.95 2.63V3.5h2.65Z"/>
          <path fill="#FE2C55" d="M16.8 5.1c1 .7 2.2 1.1 3.5 1.1V8.4c-1.2 0-2.3-.3-3.3-.9V14a5.1 5.1 0 1 1-5.1-5.1v2.35a2.75 2.75 0 1 0 1.95 2.63V3.5h2.65c.1 1 .5 1.9 1.1 2.6Z"/>
          <path fill="#fff" d="M16.3 4.8c1 .7 2.2 1.1 3.5 1.1V8.1c-1.2 0-2.3-.3-3.3-.9V13a5.1 5.1 0 1 1-5.1-5.1v2.35a2.75 2.75 0 1 0 1.95 2.63V3.2h2.65c.1 1 .5 1.9 1.1 2.6Z"/>
        </svg>
      }
      @case ('youtube') {
        <svg class="platform-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#FF0000" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8Z"/>
          <path fill="#fff" d="M9.8 15.6V8.4L16.2 12 9.8 15.6Z"/>
        </svg>
      }
      @case ('facebook') {
        <svg class="platform-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.9V12h2.2V9.8c0-2.2 1.3-3.4 3.3-3.4.9 0 1.9.2 1.9.2v2.1h-1.1c-1.1 0-1.4.7-1.4 1.4V12h2.4l-.4 2.5h-2v8.4A12 12 0 0 0 24 12Z"/>
        </svg>
      }
      @default {
        <svg class="platform-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.35"/>
        </svg>
      }
    }
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .platform-icon-svg {
      width: 100%;
      height: 100%;
      display: block;
    }
  `],
})
export class PlatformIconComponent {
  @Input({ required: true }) platform!: string;
  readonly igGradId = `rd-ig-${++platformIconSeq}`;
}
