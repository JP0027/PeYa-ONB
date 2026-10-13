/**
 * sheetsQueue.ts
 * Cola secuencial y sistema de reintentos con retroceso exponencial para Google Sheets API.
 * Evita errores 429 (Too Many Requests), colisiones de escritura simultánea entre múltiples usuarios
 * y problemas de asignación de filas al insertar casos concurrentemente en Vercel, Netlify y Render.
 */

export class SheetsWriteQueue {
  private queue: (() => Promise<any>)[] = [];
  private isProcessing = false;

  /**
   * Encola una tarea asíncrona de escritura para ejecutarla de forma estrictamente secuencial
   */
  public enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });

      this.processNext();
    });
  }

  private async processNext() {
    if (this.isProcessing) return;
    if (this.queue.length === 0) return;

    this.isProcessing = true;
    const currentTask = this.queue.shift();

    if (currentTask) {
      try {
        await currentTask();
      } catch (e) {
        console.warn('[SheetsWriteQueue] Error procesando tarea en cola:', e);
      } finally {
        // Pausa de 120ms entre peticiones consecutivas para respetar la cuota de Google Sheets (60 writes/min)
        await new Promise(r => setTimeout(r, 120));
        this.isProcessing = false;
        this.processNext();
      }
    } else {
      this.isProcessing = false;
    }
  }

  /**
   * Ejecuta una petición HTTP contra Google Sheets con reintentos automáticos
   * y retroceso exponencial con variación (jitter) ante errores 429, 500 y 503.
   */
  public static async fetchConReintento(
    url: string,
    options: RequestInit,
    maxReintentos: number = 4,
    delayBaseMs: number = 800
  ): Promise<Response> {
    let ultimoError: any = null;

    for (let intento = 0; intento < maxReintentos; intento++) {
      try {
        const res = await fetch(url, options);

        // Si la cuota fue excedida (429) o error transitorio de Google (500, 502, 503)
        if (res.status === 429 || res.status === 500 || res.status === 502 || res.status === 503) {
          const jitter = Math.floor(Math.random() * 400);
          const esperaMs = (delayBaseMs * Math.pow(2, intento)) + jitter;
          console.warn(`[SheetsQueue] Google Sheets respondió HTTP ${res.status}. Reintentando en ${esperaMs}ms (intento ${intento + 1}/${maxReintentos})...`);
          await new Promise(r => setTimeout(r, esperaMs));
          continue;
        }

        return res;
      } catch (err: any) {
        ultimoError = err;
        const jitter = Math.floor(Math.random() * 400);
        const esperaMs = (delayBaseMs * Math.pow(2, intento)) + jitter;
        console.warn(`[SheetsQueue] Error de red al consultar Google Sheets: ${err?.message}. Reintento en ${esperaMs}ms...`);
        if (intento === maxReintentos - 1) throw err;
        await new Promise(r => setTimeout(r, esperaMs));
      }
    }

    throw ultimoError || new Error('Google Sheets API no respondió tras varios reintentos');
  }
}

// Instancia singleton compartida en memoria para el proceso
export const sheetsWriteQueue = new SheetsWriteQueue();
