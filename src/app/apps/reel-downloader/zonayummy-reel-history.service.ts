import { Injectable } from '@angular/core';
import { ZonayummyAuthService } from './zonayummy-auth.service';

export interface ZonayummyReelHistoryItem {
  id: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'facebook' | string;
  url: string;
  blobPath: string;
  blobUrl?: string;
  downloadUrlWithSas?: string | null;
  contentType?: string;
  size?: number;
  createdAt: number;
  updatedAt?: number;
  // Nuevos campos
  folderId?: string | null;
  labelIds?: string[];
  description?: string;
  title?: string;
  thumbnailPath?: string;
  thumbnailUrlWithSas?: string | null;
}

export interface ZonayummyFolder {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  parentId?: string | null;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface ZonayummyLabel {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  usageCount: number;
}

@Injectable({ providedIn: 'root' })
export class ZonayummyReelHistoryService {
  constructor(private auth: ZonayummyAuthService) {}

  private authHeaders(): Record<string, string> {
    const token = this.auth.getToken();
    if (!token) throw new Error('No hay token de ZonaYummy');
    return { Authorization: `Bearer ${token}` };
  }

  async list(): Promise<{ ok: true; items: ZonayummyReelHistoryItem[]; expiryTime?: number | null } | { ok: false; error: string }> {
    try {
      const res = await fetch(`${this.auth.apiBaseUrl}/reel-downloader/user-links`, {
        method: 'GET',
        headers: { ...this.authHeaders() },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json?.error || `Error (${res.status})` };
      return { ok: true, items: json?.items || [], expiryTime: json?.expiryTime ?? null };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error listando historial' };
    }
  }

  async getUploadUrl(params: { platform: string; url: string; contentType?: string }): Promise<
    | { ok: true; downloadId: string; blobPath: string; blobUrl: string; uploadUrlWithSas: string; downloadUrlWithSas: string; expiryTime: number }
    | { ok: false; error: string }
  > {
    try {
      const res = await fetch(`${this.auth.apiBaseUrl}/reel-downloader/user-links/get-upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify(params),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json?.error || `Error (${res.status})` };
      return { ok: true, ...json };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error generando URL de subida' };
    }
  }

  async createRecord(payload: { downloadId: string; platform: string; url: string; blobPath: string; contentType?: string; size?: number }): Promise<
    | { ok: true; downloadId: string; createdAt: number }
    | { ok: false; error: string }
  > {
    try {
      const res = await fetch(`${this.auth.apiBaseUrl}/reel-downloader/user-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json?.error || `Error (${res.status})` };
      return { ok: true, downloadId: json.downloadId, createdAt: json.createdAt };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error guardando registro' };
    }
  }

  async delete(downloadId: string, deleteBlob: boolean = true): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const qs = deleteBlob ? '' : '?deleteBlob=false';
      const res = await fetch(`${this.auth.apiBaseUrl}/reel-downloader/user-links/${encodeURIComponent(downloadId)}${qs}`, {
        method: 'DELETE',
        headers: { ...this.authHeaders() },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json?.error || `Error (${res.status})` };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error eliminando' };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ACTUALIZAR ITEM
  // ─────────────────────────────────────────────────────────────────────────────

  async updateItem(
    downloadId: string,
    updates: { folderId?: string | null; labelIds?: string[]; description?: string; title?: string }
  ): Promise<{ ok: true; item: ZonayummyReelHistoryItem } | { ok: false; error: string }> {
    try {
      const res = await fetch(`${this.auth.apiBaseUrl}/reel-downloader/user-links/${encodeURIComponent(downloadId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify(updates),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json?.error || `Error (${res.status})` };
      return { ok: true, item: json.item };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error actualizando item' };
    }
  }

  async moveItems(downloadIds: string[], folderId: string | null): Promise<{ ok: true; movedCount: number } | { ok: false; error: string }> {
    try {
      const res = await fetch(`${this.auth.apiBaseUrl}/reel-downloader/user-links/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify({ downloadIds, folderId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json?.error || `Error (${res.status})` };
      return { ok: true, movedCount: json.movedCount };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error moviendo items' };
    }
  }

  async generateThumbnail(downloadId: string): Promise<{ ok: true; thumbnailPath: string; thumbnailUrlWithSas: string | null; existed: boolean } | { ok: false; error: string }> {
    try {
      const res = await fetch(`${this.auth.apiBaseUrl}/reel-downloader/user-links/${encodeURIComponent(downloadId)}/thumbnail`, {
        method: 'POST',
        headers: { ...this.authHeaders() },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json?.error || `Error (${res.status})` };
      return { ok: true, thumbnailPath: json.thumbnailPath, thumbnailUrlWithSas: json.thumbnailUrlWithSas || null, existed: json.existed };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error generando thumbnail' };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CARPETAS
  // ─────────────────────────────────────────────────────────────────────────────

  async listFolders(): Promise<{ ok: true; folders: ZonayummyFolder[] } | { ok: false; error: string }> {
    try {
      const res = await fetch(`${this.auth.apiBaseUrl}/reel-downloader/folders`, {
        method: 'GET',
        headers: { ...this.authHeaders() },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json?.error || `Error (${res.status})` };
      return { ok: true, folders: json?.folders || [] };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error listando carpetas' };
    }
  }

  async createFolder(data: { name: string; color?: string; icon?: string; parentId?: string }): Promise<{ ok: true; folder: ZonayummyFolder } | { ok: false; error: string }> {
    try {
      const res = await fetch(`${this.auth.apiBaseUrl}/reel-downloader/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json?.error || `Error (${res.status})` };
      return { ok: true, folder: json.folder };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error creando carpeta' };
    }
  }

  async updateFolder(folderId: string, updates: { name?: string; color?: string; icon?: string; order?: number }): Promise<{ ok: true; folder: ZonayummyFolder } | { ok: false; error: string }> {
    try {
      const res = await fetch(`${this.auth.apiBaseUrl}/reel-downloader/folders/${encodeURIComponent(folderId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify(updates),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json?.error || `Error (${res.status})` };
      return { ok: true, folder: json.folder };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error actualizando carpeta' };
    }
  }

  async deleteFolder(folderId: string): Promise<{ ok: true; deletedIds: string[] } | { ok: false; error: string }> {
    try {
      const res = await fetch(`${this.auth.apiBaseUrl}/reel-downloader/folders/${encodeURIComponent(folderId)}`, {
        method: 'DELETE',
        headers: { ...this.authHeaders() },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json?.error || `Error (${res.status})` };
      return { ok: true, deletedIds: json.deletedIds || [] };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error eliminando carpeta' };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ETIQUETAS
  // ─────────────────────────────────────────────────────────────────────────────

  async listLabels(): Promise<{ ok: true; labels: ZonayummyLabel[]; colors: string[] } | { ok: false; error: string }> {
    try {
      const res = await fetch(`${this.auth.apiBaseUrl}/reel-downloader/labels`, {
        method: 'GET',
        headers: { ...this.authHeaders() },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json?.error || `Error (${res.status})` };
      return { ok: true, labels: json?.labels || [], colors: json?.colors || [] };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error listando etiquetas' };
    }
  }

  async createLabel(data: { name: string; color?: string }): Promise<{ ok: true; label: ZonayummyLabel; existed: boolean } | { ok: false; error: string }> {
    try {
      const res = await fetch(`${this.auth.apiBaseUrl}/reel-downloader/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json?.error || `Error (${res.status})` };
      return { ok: true, label: json.label, existed: json.existed || false };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error creando etiqueta' };
    }
  }

  async createLabels(names: string[]): Promise<{ ok: true; labels: ZonayummyLabel[] } | { ok: false; error: string }> {
    try {
      const res = await fetch(`${this.auth.apiBaseUrl}/reel-downloader/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify({ names }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json?.error || `Error (${res.status})` };
      return { ok: true, labels: json.labels || [] };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error creando etiquetas' };
    }
  }

  async deleteLabel(labelId: string): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const res = await fetch(`${this.auth.apiBaseUrl}/reel-downloader/labels/${encodeURIComponent(labelId)}`, {
        method: 'DELETE',
        headers: { ...this.authHeaders() },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json?.error || `Error (${res.status})` };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error eliminando etiqueta' };
    }
  }
}


