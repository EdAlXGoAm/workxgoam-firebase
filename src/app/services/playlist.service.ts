// src/app/services/playlist.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, deleteDoc, doc } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { Observable } from 'rxjs';

export interface Playlist {
  id?: string;
  name: string;
  ownerId: string;
  createdAt: any;
}

export interface VideoEntry {
  id?: string;       // ID del documento en Firestore
  videoId: string;   // ID del video de YouTube
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

@Injectable({
  providedIn: 'root'
})
export class PlaylistService {
  constructor(private firestore: Firestore, private authService: AuthService) {}

  getPlaylists(): Observable<Playlist[]> {
    const playlistsRef = collection(this.firestore, 'playlists');
    return collectionData(playlistsRef, { idField: 'id' }) as Observable<Playlist[]>;
  }

  createPlaylist(name: string): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return Promise.reject('Usuario no autenticado');
    }
    const playlistsRef = collection(this.firestore, 'playlists');
    return addDoc(playlistsRef, {
      name,
      ownerId: user.uid,
      createdAt: new Date()
    }).then(() => {});
  }

  getVideos(playlistId: string): Observable<VideoEntry[]> {
    const videosRef = collection(this.firestore, `playlists/${playlistId}/videos`);
    return collectionData(videosRef, { idField: 'id' }) as Observable<VideoEntry[]>;
  }

  addVideoToPlaylist(playlistId: string, video: VideoEntry): Promise<void> {
    const videosRef = collection(this.firestore, `playlists/${playlistId}/videos`);
    return addDoc(videosRef, {
      videoId: video.videoId,
      url: video.url,
      thumbnail: video.thumbnail,
      title: video.title,
      channel: video.channel,
      views: video.views,
      likes: video.likes,
      comments: video.comments,
      duration: video.duration,
      publishedAt: video.publishedAt,
      description: video.description
    }).then(() => {});
  }

  removeVideoFromPlaylist(playlistId: string, videoDocId: string): Promise<void> {
    const videoDoc = doc(this.firestore, `playlists/${playlistId}/videos/${videoDocId}`);
    return deleteDoc(videoDoc);
  }
} 