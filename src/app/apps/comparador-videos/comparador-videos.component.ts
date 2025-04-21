import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { PlaylistService, VideoEntry } from '../../services/playlist.service';
import { UserService, UserProfile } from '../../services/user.service';
import { Firestore, doc, updateDoc } from '@angular/fire/firestore';
import { AuthService } from '../../services/auth.service';

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
  validations?: { [validatorId: string]: boolean };
  createdAt?: any;
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
  playlists: any[] = [];
  allUsers: UserProfile[] = [];
  selectedPlaylistId = '';
  newPlaylistName = '';
  private videoDocMap: { [videoId: string]: string } = {};
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
  validators: string[] = [];
  selectedValidatorUid = '';
  currentUserUid: string | null = null;

  constructor(private http: HttpClient,
              private sanitizer: DomSanitizer,
              private playlistService: PlaylistService,
              private firestore: Firestore,
              private userService: UserService,
              private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      this.currentUserUid = user?.uid || null;
    });
    // Cargar todas las playlists
    this.playlistService.getPlaylists().subscribe((pls: any[]) => {
      this.playlists = pls;
      // Seleccionar por defecto la primera playlist y cargar sus videos
      if (pls.length > 0 && !this.selectedPlaylistId) {
        this.selectedPlaylistId = pls[0].id;
        this.onPlaylistChange();
      }
    });
    // Cargar usuarios registrados
    this.userService.getUsers().subscribe((us: UserProfile[]) => {
      this.allUsers = us;
    });
  }

  createPlaylist(): void {
    if (!this.newPlaylistName.trim()) {
      alert('Ingrese un nombre de playlist');
      return;
    }
    this.playlistService.createPlaylist(this.newPlaylistName)
      .then(() => {
        this.newPlaylistName = '';
      })
      .catch((err: any) => {
        alert(err);
      });
  }

  /** Eliminar la playlist seleccionada */
  deletePlaylist(): void {
    if (!this.selectedPlaylistId) {
      alert('Seleccione una playlist primero');
      return;
    }
    if (!confirm(`¿Seguro que quieres eliminar la playlist "${this.currentPlaylistName}"?`)) {
      return;
    }
    this.playlistService.deletePlaylist(this.selectedPlaylistId)
      .then(() => {
        // Refrescar listas y limpiar selección
        this.selectedPlaylistId = '';
        this.videos = [];
        this.validators = [];
        this.playlistService.getPlaylists().subscribe((pls: any[]) => {
          this.playlists = pls;
        });
      })
      .catch(() => alert('Error al eliminar la playlist'));
  }

  onPlaylistChange(): void {
    if (!this.selectedPlaylistId) {
      this.videos = [];
      this.validators = [];
      return;
    }
    // Obtener validadores de la playlist seleccionada
    const pl = this.playlists.find(p => p.id === this.selectedPlaylistId) as any;
    this.validators = pl?.validators || [];
    // Cargar videos con sus validaciones y fecha de creación
    this.playlistService.getVideos(this.selectedPlaylistId).subscribe((entries: any[]) => {
      this.videoDocMap = {};
      this.videos = entries.map(entry => {
        this.videoDocMap[entry.videoId] = entry.id;
        return {
          id: entry.videoId,
          url: entry.url,
          thumbnail: entry.thumbnail,
          title: entry.title,
          channel: entry.channel,
          views: entry.views,
          likes: entry.likes,
          comments: entry.comments,
          duration: entry.duration,
          publishedAt: entry.publishedAt,
          description: entry.description,
          validations: entry.validations || {},
          createdAt: entry.createdAt
        } as Video;
      });
      this.sortVideos();
    });
  }

  // Ordenar videos según validaciones y fecha de creación
  sortVideos(): void {
    if (this.validators.length === 0) {
      this.videos.sort((a, b) =>
        (new Date(a.createdAt).getTime() || 0) - (new Date(b.createdAt).getTime() || 0)
      );
    } else {
      this.videos.sort((a, b) => {
        const countA = this.validators.filter(v => a.validations?.[v]).length;
        const countB = this.validators.filter(v => b.validations?.[v]).length;
        if (countA !== countB) return countA - countB;
        return (new Date(a.createdAt).getTime() || 0) - (new Date(b.createdAt).getTime() || 0);
      });
    }
  }

  // Marcar o desmarcar validación y reordenar
  toggleValidation(videoId: string, validatorId: string, event: Event): void {
    event.stopPropagation();
    const status = (event.target as HTMLInputElement).checked;
    const docId = this.videoDocMap[videoId];
    // Actualizar validación en Firestore
    const ref = doc(this.firestore, `playlists/${this.selectedPlaylistId}/videos/${docId}`);
    updateDoc(ref, { [`validations.${validatorId}`]: status })
      .then(() => this.sortVideos())
      .catch(() => alert('Error al actualizar validación'));
  }

  // Agregar y quitar validadores de la playlist
  addValidator(): void {
    const v = this.selectedValidatorUid.trim();
    if (!v) { alert('Seleccione un validador'); return; }
    if (this.validators.includes(v)) { alert('Validador ya agregado'); return; }
    const updated = [...this.validators, v];
    // Actualizar validadores en Firestore
    const ref = doc(this.firestore, 'playlists', this.selectedPlaylistId);
    updateDoc(ref, { validators: updated })
      .then(() => {
        // Refrescar UI
        this.validators = updated;
      })
      .catch(() => alert('Error actualizando validadores'));
  }

  removeValidator(v: string): void {
    // Confirmar antes de eliminar validador
    if (!confirm(`¿Seguro que quieres eliminar al validador "${v}"?`)) {
      return;
    }
    const updated = this.validators.filter(x => x !== v);
    const ref = doc(this.firestore, 'playlists', this.selectedPlaylistId);
    updateDoc(ref, { validators: updated })
      .then(() => {
        // Refrescar UI
        this.validators = updated;
      })
      .catch(() => alert('Error actualizando validadores'));
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
    if (!this.selectedPlaylistId) {
      alert('Seleccione una playlist primero');
      return;
    }
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
          const videoData: VideoEntry = {
            videoId,
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
          };
          this.playlistService.addVideoToPlaylist(this.selectedPlaylistId, videoData)
            .then(() => this.videoUrl = '')
            .catch(() => alert('Error al agregar el video'));
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
    if (!this.selectedPlaylistId) {
      alert('Seleccione una playlist primero');
      return;
    }
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
          const videoEntry: VideoEntry = {
            videoId: item.id,
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
          };
          this.playlistService.addVideoToPlaylist(this.selectedPlaylistId, videoEntry)
            .then(() => {
              this.searchResults = [];
              this.searchQuery = '';
            })
            .catch(() => alert('Error al agregar el video'));
        },
        error: () => alert('Error al obtener detalles del video')
      });
  }

  removeVideo(id: string, event?: Event) {
    event?.stopPropagation();
    if (confirm(`¿Seguro que quieres eliminar este video de la playlist "${this.currentPlaylistName}"?`)) {
      const docId = this.videoDocMap[id];
      this.playlistService.removeVideoFromPlaylist(this.selectedPlaylistId, docId)
        .catch(() => alert('Error al eliminar el video'));
    }
  }

  clearAll() {
    if (confirm(`¿Seguro que quieres eliminar todos los videos de la playlist "${this.currentPlaylistName}"?`)) {
      this.videos.forEach(v => {
        const docId = this.videoDocMap[v.id];
        this.playlistService.removeVideoFromPlaylist(this.selectedPlaylistId, docId);
      });
      this.selectedVideos = [];
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

  get currentPlaylistName(): string {
    const pl = this.playlists.find(p => p.id === this.selectedPlaylistId);
    return pl ? pl.name : '';
  }

  /** Devuelve el nombre o email de un validador dado su UID */
  getUserLabel(uid: string): string {
    const user = this.allUsers.find(u => u.uid === uid);
    return user ? (user.displayName ?? user.email ?? uid) : uid;
  }

  /** Devuelve etiqueta para el checkbox: Primer nombre + usuario (parte antes de @) */
  getCheckboxLabel(uid: string): string {
    const user = this.allUsers.find(u => u.uid === uid);
    let firstName = '';
    let emailPrefix = '';
    if (user) {
      if (user.displayName) {
        firstName = user.displayName.split(' ')[0];
      }
      if (user.email) {
        const parts = user.email.split('@');
        emailPrefix = parts[0];
        // si no hay displayName, usar emailPrefix como firstName
        if (!firstName) {
          firstName = emailPrefix;
        }
      }
    }
    return `${firstName} (${emailPrefix})`.trim();
  }
} 