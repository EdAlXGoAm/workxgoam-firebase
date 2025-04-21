import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';

interface Video {
  id: string;
  url: string;
  thumbnail: string;
  title: string;
  channel: string;
  views: number | string;
  likes: number | string;
  comments: number | string;
  duration: string;
  publishedAt: string;
  description: string;
}

@Component({
  selector: 'app-comparador-videos',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, RouterModule],
  templateUrl: './comparador-videos.component.html',
  styleUrls: ['./comparador-videos.component.css']
})
export class ComparadorVideosComponent implements OnInit {
  YOUTUBE_API_KEY = 'AIzaSyDRbb3BWx_9kLbuUJnFif17aYzXv1ygoUs';
  searchQuery = '';
  videoUrl = '';
  videos: Video[] = [];
  selectedVideos: string[] = [];
  searchResults: any[] = [];
  isLoadingSearch = false;
  isProcessingAdd = false;
  errorMessage = '';
  playerUrl: SafeResourceUrl | null = null;
  player1Url: SafeResourceUrl | null = null;
  player2Url: SafeResourceUrl | null = null;
  video1: Video | null = null;
  video2: Video | null = null;
  currentVideoId: string | null = null;

  constructor(private http: HttpClient, private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    const stored = localStorage.getItem('youtubeVideos');
    this.videos = stored ? JSON.parse(stored) : [];
  }

  isValidYouTubeUrl(url: string): boolean {
    const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
    return pattern.test(url);
  }

  extractVideoId(url: string): string | null {
    const regExp = /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[1].length === 11 ? match[1] : null;
  }

  addVideoByUrl(): void {
    const url = this.videoUrl.trim();
    if (!this.isValidYouTubeUrl(url)) {
      this.errorMessage = 'Por favor ingresa un enlace válido de YouTube';
      return;
    }
    this.errorMessage = '';
    const videoId = this.extractVideoId(url) as string;
    if (!videoId) {
      this.errorMessage = 'No se pudo extraer el ID del video';
      return;
    }
    if (this.videos.some(v => v.id === videoId)) {
      alert('Este video ya está en tu lista');
      return;
    }
    this.isProcessingAdd = true;
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

    this.http
      .get('https://www.googleapis.com/youtube/v3/videos', {
        params: {
          part: 'snippet,contentDetails,statistics',
          id: videoId,
          key: this.YOUTUBE_API_KEY
        }
      })
      .subscribe({
        next: (data: any) => {
          const item = data.items[0];
          const snippet = item.snippet;
          const stats = item.statistics;
          const duration = this.formatDuration(item.contentDetails.duration);
          this.videos.push({
            id: videoId,
            url: `https://www.youtube.com/embed/${videoId}`,
            thumbnail: thumbnailUrl,
            title: snippet.title,
            channel: snippet.channelTitle,
            views: stats.viewCount,
            likes: stats.likeCount,
            comments: stats.commentCount,
            duration,
            publishedAt: this.formatDate(snippet.publishedAt),
            description: snippet.description
          });
          localStorage.setItem('youtubeVideos', JSON.stringify(this.videos));
          this.videoUrl = '';
        },
        error: () => {
          alert('Error al obtener detalles del video');
        },
        complete: () => {
          this.isProcessingAdd = false;
        }
      });
  }

  searchVideos() {
    const q = this.searchQuery.trim();
    if (!q) {
      alert('Por favor ingresa un término de búsqueda');
      return;
    }
    if (!this.YOUTUBE_API_KEY || this.YOUTUBE_API_KEY === 'TU_CLAVE_DE_API_AQUI') {
      alert('Debes configurar una clave de API válida');
      return;
    }
    this.searchResults = [];
    this.isLoadingSearch = true;
    this.http
      .get('https://www.googleapis.com/youtube/v3/search', {
        params: { part: 'snippet', maxResults: '10', q, type: 'video', key: this.YOUTUBE_API_KEY }
      })
      .subscribe({
        next: (data: any) => {
          this.searchResults = data.items.map((item: any) => ({
            id: item.id.videoId,
            thumbnail: item.snippet.thumbnails.medium.url,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            description: item.snippet.description
          }));
        },
        error: () => alert('Error al buscar videos'),
        complete: () => (this.isLoadingSearch = false)
      });
  }

  selectSearchResult(item: any) {
    if (this.videos.some(v => v.id === item.id)) {
      alert('Este video ya está en tu lista');
      return;
    }
    const thumbnailUrl = item.thumbnail;
    this.http
      .get('https://www.googleapis.com/youtube/v3/videos', {
        params: { part: 'snippet,contentDetails,statistics', id: item.id, key: this.YOUTUBE_API_KEY }
      })
      .subscribe({
        next: (data: any) => {
          const detail = data.items[0];
          const snippet = detail.snippet;
          const stats = detail.statistics;
          const duration = this.formatDuration(detail.contentDetails.duration);
          this.videos.push({
            id: item.id,
            url: `https://www.youtube.com/embed/${item.id}`,
            thumbnail: thumbnailUrl,
            title: snippet.title,
            channel: snippet.channelTitle,
            views: stats.viewCount,
            likes: stats.likeCount,
            comments: stats.commentCount,
            duration,
            publishedAt: this.formatDate(snippet.publishedAt),
            description: snippet.description
          });
          localStorage.setItem('youtubeVideos', JSON.stringify(this.videos));
          this.searchResults = [];
          this.searchQuery = '';
        },
        error: () => alert('Error al obtener detalles del video')
      });
  }

  removeVideo(id: string, event?: Event) {
    event?.stopPropagation();
    if (confirm('¿Seguro que quieres eliminar este video?')) {
      this.videos = this.videos.filter(v => v.id !== id);
      this.selectedVideos = this.selectedVideos.filter(i => i !== id);
      localStorage.setItem('youtubeVideos', JSON.stringify(this.videos));
    }
  }

  clearAll() {
    if (confirm('¿Seguro que quieres eliminar todos los videos?')) {
      this.videos = [];
      this.selectedVideos = [];
      localStorage.removeItem('youtubeVideos');
    }
  }

  toggleSelection(id: string, event: Event) {
    event.stopPropagation();
    if (this.selectedVideos.includes(id)) {
      this.selectedVideos = this.selectedVideos.filter(i => i !== id);
    } else {
      if (this.selectedVideos.length >= 2) {
        alert('Solo puedes seleccionar hasta 2');
        return;
      }
      this.selectedVideos.push(id);
    }
  }

  playVideo(video: Video): void {
    if (this.selectedVideos.length >= 2) return;
    this.video1 = null;
    this.video2 = null;
    this.currentVideoId = video.id;
    this.playerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(video.url + '?autoplay=1');
  }

  compareVideos(): void {
    if (this.selectedVideos.length !== 2) {
      alert('Selecciona exactamente 2 videos');
      return;
    }
    const v1 = this.videos.find(v => v.id === this.selectedVideos[0]);
    const v2 = this.videos.find(v => v.id === this.selectedVideos[1]);
    if (v1 && v2) {
      this.video1 = v1;
      this.video2 = v2;
      this.playerUrl = null;
      this.player1Url = this.sanitizer.bypassSecurityTrustResourceUrl(v1.url + '?autoplay=1');
      this.player2Url = this.sanitizer.bypassSecurityTrustResourceUrl(v2.url + '?autoplay=1');
    }
  }

  formatDuration(dur: string): string {
    const m = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 'N/A';
    const h = parseInt(m[1] || '0');
    const min = parseInt(m[2] || '0');
    const s = parseInt(m[3] || '0');
    return h
      ? `${h}:${min.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${min}:${s.toString().padStart(2, '0')}`;
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  formatNumber(num: number | string): string {
    if (!num || isNaN(+num)) return 'N/A';
    return (+num).toLocaleString();
  }
} 