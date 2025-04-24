import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PlatillosService {
  private baseUrl = `${environment.apiUrl}/api/platillos`;

  constructor(private http: HttpClient) {}

  getPlatillos(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/get`);
  }
} 