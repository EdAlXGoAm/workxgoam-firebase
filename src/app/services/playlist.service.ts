// src/app/services/playlist.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, doc, docData, addDoc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { Observable } from 'rxjs';

export interface Playlist {
  id?: string;
  name: string;
  ownerId: string;
  createdAt: any;
  validators?: string[];
}

export interface VideoEntry {
  id?: string;                // ID del documento en Firestore
  videoId: string;            // ID del video de YouTube
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

@Injectable({ providedIn: 'root' })
export class PlaylistService {
  constructor(private firestore: Firestore, private authService: AuthService) {}

  /** Obtener todas las playlists */
  getPlaylists(): Observable<Playlist[]> {
    const ref = collection(this.firestore, 'playlists');
    return collectionData(ref, { idField: 'id' }) as Observable<Playlist[]>;
  }

  /** Obtener datos de una playlist (incluye validadores) */
  getPlaylist(playlistId: string): Observable<Playlist> {
    const ref = doc(this.firestore, 'playlists', playlistId);
    return docData(ref, { idField: 'id' }) as Observable<Playlist>;
  }

  /** Crear nueva playlist */
  createPlaylist(name: string): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) return Promise.reject('Usuario no autenticado');
    const ref = collection(this.firestore, 'playlists');
    return addDoc(ref, { name, ownerId: user.uid, createdAt: new Date(), validators: [] }).then(() => {});
  }

  /** Actualizar lista de validadores en la playlist */
  updateValidators(playlistId: string, validators: string[]): Promise<void> {
    const ref = doc(this.firestore, 'playlists', playlistId);
    return updateDoc(ref, { validators });
  }

  /** Obtener videos de la playlist */
  getVideos(playlistId: string): Observable<VideoEntry[]> {
    const ref = collection(this.firestore, `playlists/${playlistId}/videos`);
    return collectionData(ref, { idField: 'id' }) as Observable<VideoEntry[]>;
  }

  /** Agregar video a playlist */
  addVideoToPlaylist(playlistId: string, video: VideoEntry): Promise<void> {
    const ref = collection(this.firestore, `playlists/${playlistId}/videos`);
    const data: any = { ...video, validations: {}, createdAt: new Date() };
    delete data.id;
    return addDoc(ref, data).then(() => {});
  }

  /** Actualizar validación de un video por un validador */
  updateValidation(playlistId: string, videoDocId: string, validatorId: string, status: boolean): Promise<void> {
    const ref = doc(this.firestore, `playlists/${playlistId}/videos/${videoDocId}`);
    return updateDoc(ref, { [`validations.${validatorId}`]: status });
  }

  /** Eliminar video de playlist */
  removeVideoFromPlaylist(playlistId: string, videoDocId: string): Promise<void> {
    const ref = doc(this.firestore, `playlists/${playlistId}/videos/${videoDocId}`);
    return deleteDoc(ref);
  }

  /** Eliminar playlist */
  deletePlaylist(playlistId: string): Promise<void> {
    const ref = doc(this.firestore, 'playlists', playlistId);
    return deleteDoc(ref);
  }
} 