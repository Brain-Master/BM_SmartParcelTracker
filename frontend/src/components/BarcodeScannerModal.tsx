/**
 * Modal for scanning QR code or barcode (e.g. tracking number).
 * Uses camera when available, with fallback to file upload.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

export interface BarcodeScannerModalProps {
  open: boolean
  onClose: () => void
  onScanned: (text: string) => void
}

export function BarcodeScannerModal({ open, onClose, onScanned }: BarcodeScannerModalProps) {
  const containerId = useId().replace(/:/g, '-')
  const [status, setStatus] = useState<'idle' | 'starting' | 'scanning' | 'file' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const startedRef = useRef(false)

  const stopCamera = useCallback(async () => {
    if (!scannerRef.current || !startedRef.current) return
    try {
      await scannerRef.current.stop()
    } catch {
      // ignore
    }
    startedRef.current = false
    scannerRef.current = null
  }, [])

  const startCamera = useCallback(async () => {
    if (!open) return
    setStatus('starting')
    setErrorMessage(null)
    try {
      const scanner = new Html5Qrcode(containerId)
      scannerRef.current = scanner
      const cameras = await Html5Qrcode.getCameras()
      if (!cameras || cameras.length === 0) {
        setStatus('error')
        setErrorMessage('Камера не найдена. Используйте загрузку фото.')
        return
      }
      const cameraId = cameras[0].id
      await scanner.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
        },
        (decodedText) => {
          onScanned(decodedText.trim())
          void stopCamera()
          onClose()
        },
        () => {}
      )
      startedRef.current = true
      setStatus('scanning')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setStatus('error')
      setErrorMessage(msg.includes('Permission') || msg.includes('NotAllowed')
        ? 'Нет доступа к камере. Разрешите доступ в настройках браузера или загрузите фото.'
        : msg)
    }
  }, [open, containerId, onScanned, onClose, stopCamera])

  useEffect(() => {
    if (!open) {
      void stopCamera()
      setStatus('idle')
      setErrorMessage(null)
      return
    }
    void startCamera()
    return () => {
      void stopCamera()
    }
  }, [open, startCamera, stopCamera])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/54df445e-4a08-4be2-8a39-344fabb09a6e', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'BarcodeScannerModal.tsx:handleFileChange', message: 'file selected', data: { hasFile: !!file, fileName: file?.name, fileSize: file?.size, scannerActive: !!scannerRef.current, startedRef: startedRef.current }, timestamp: Date.now(), hypothesisId: 'H1' }) }).catch(() => {})
      // #endregion
      if (!file) return
      setStatus('file')
      setErrorMessage(null)
      // Stop camera first: html5-qrcode throws "Cannot start file scan - ongoing camera scan" if camera is running
      await stopCamera()
      const fileScanner = new Html5Qrcode(containerId)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/54df445e-4a08-4be2-8a39-344fabb09a6e', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'BarcodeScannerModal.tsx:beforeScanFile', message: 'calling scanFile after stopCamera', data: {}, timestamp: Date.now(), hypothesisId: 'H2' }) }).catch(() => {})
      // #endregion
      let scanPromise: Promise<string>
      try {
        scanPromise = fileScanner.scanFile(file, false)
      } catch (syncErr) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/54df445e-4a08-4be2-8a39-344fabb09a6e', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'BarcodeScannerModal.tsx:scanFileSyncThrow', message: 'sync throw', data: { err: String(syncErr) }, timestamp: Date.now(), hypothesisId: 'H2' }) }).catch(() => {})
        // #endregion
        setErrorMessage(String(syncErr))
        setStatus('error')
        e.target.value = ''
        return
      }
      scanPromise
        .then((decodedText) => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/54df445e-4a08-4be2-8a39-344fabb09a6e', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'BarcodeScannerModal.tsx:scanFileThen', message: 'decoded', data: { decodedText: typeof decodedText === 'string' ? decodedText : String(decodedText), len: typeof decodedText === 'string' ? decodedText.length : 0 }, timestamp: Date.now(), hypothesisId: 'H3' }) }).catch(() => {})
          // #endregion
          onScanned(decodedText.trim())
          onClose()
        })
        .catch((err: Error) => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/54df445e-4a08-4be2-8a39-344fabb09a6e', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'BarcodeScannerModal.tsx:scanFileCatch', message: 'scanFile rejected', data: { errMsg: err?.message, errStr: String(err) }, timestamp: Date.now(), hypothesisId: 'H3' }) }).catch(() => {})
          // #endregion
          const msg = err?.message ?? String(err)
          const friendlyMessage = msg.includes('MultiFormat Readers') || msg.includes('detect the code')
            ? 'В изображении не найден QR-код или штрихкод. Убедитесь, что код чётко виден и попробуйте другое фото.'
            : msg
          setErrorMessage(friendlyMessage)
          setStatus('error')
        })
        .finally(() => {
          e.target.value = ''
        })
    },
    [containerId, onScanned, onClose, stopCamera]
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-scanner-title"
    >
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h2 id="barcode-scanner-title" className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            Сканировать QR или штрихкод
          </h2>
          <button
            type="button"
            onClick={() => { void stopCamera(); onClose() }}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
        <div className="p-4 space-y-3">
          {status === 'error' && errorMessage && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {errorMessage}
            </p>
          )}
          <div
            id={containerId}
            className="min-h-[200px] w-full rounded-lg overflow-hidden bg-slate-900"
          />
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600">
              <span>📷</span>
              Загрузить фото
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileChange}
              />
            </label>
            {status === 'error' && (
              <button
                type="button"
                onClick={() => startCamera()}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-600"
              >
                Повторить камеру
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
