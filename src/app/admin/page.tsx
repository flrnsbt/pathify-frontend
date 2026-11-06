'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ShieldCheck,
  Database,
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/lib/firebase/auth-context';
import { auth, getAppCheckToken } from '@/lib/firebase/config';
import { buildApiHeaders } from '@/lib/api-headers';
import { APP_CONFIG } from '@/config/app.config';
import { useI18n } from '@/lib/i18n';

interface ImportResult {
  imported: number;
  failed: number;
  errors: string[];
}

export default function AdminPage() {
  const { t } = useI18n();
  const { user, profile, loading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const isAdmin = Boolean(profile?.isAdmin);

  const authedFetch = async (url: string, init?: RequestInit): Promise<Response> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not signed in');
    const idToken = await currentUser.getIdToken();
    const appCheckToken = await getAppCheckToken();
    return fetch(url, {
      ...init,
      headers: buildApiHeaders({ appCheckToken, idToken }),
    });
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const res = await authedFetch(APP_CONFIG.api.adminExportUrl);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vectorizerr-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = async (file: File) => {
    setIsImporting(true);
    setImportResult(null);
    setImportError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { documents?: unknown[] };
      if (!Array.isArray(parsed.documents)) {
        throw new Error(t('admin.invalidBackup'));
      }
      const res = await authedFetch(APP_CONFIG.api.adminImportUrl, {
        method: 'POST',
        body: JSON.stringify({ documents: parsed.documents }),
      });
      const data = (await res.json().catch(() => ({}))) as ImportResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Import failed (${res.status})`);
      }
      setImportResult({ imported: data.imported ?? 0, failed: data.failed ?? 0, errors: data.errors ?? [] });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-40 w-full border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t('legal.common.backToVectorizer')}</span>
          </Link>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-400" />
            <span className="font-bold text-sm tracking-tight text-white">{t('admin.title')}</span>
          </div>
          <div className="w-24" />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        {loading || !user ? (
          <div className="flex items-center justify-center py-24 text-neutral-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !isAdmin ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
            <XCircle className="mx-auto h-10 w-10 text-red-400 mb-4" />
            <h1 className="text-lg font-semibold text-white mb-2">{t('admin.accessDenied')}</h1>
            <p className="text-sm text-neutral-400">{t('admin.accessDeniedBody')}</p>
          </div>
        ) : (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">{t('admin.title')}</h1>
              <p className="text-sm text-neutral-400">{t('admin.subtitle')}</p>
            </div>

            {/* Export */}
            <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-indigo-500/15 p-3 text-indigo-400 shrink-0">
                  <Database className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-white">{t('admin.exportTitle')}</h2>
                  <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
                    {t('admin.exportBody')}
                  </p>
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={isExporting}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50"
                  >
                    {isExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {isExporting ? t('admin.exporting') : t('admin.exportButton')}
                  </button>
                  {exportError && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-red-400">
                      <XCircle className="h-3.5 w-3.5 shrink-0" />
                      {exportError}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Import */}
            <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-amber-500/15 p-3 text-amber-400 shrink-0">
                  <Upload className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-white">{t('admin.importTitle')}</h2>
                  <p className="mt-1 text-xs text-neutral-400 leading-relaxed">
                    {t('admin.importBody')}
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleImportFile(file);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isImporting}
                      className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 transition disabled:opacity-50"
                    >
                      {isImporting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {isImporting ? t('admin.importing') : t('admin.importButton')}
                    </button>
                  </div>

                  {importError && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-red-400">
                      <XCircle className="h-3.5 w-3.5 shrink-0" />
                      {importError}
                    </p>
                  )}

                  {importResult && (
                    <div
                      className={`mt-4 rounded-lg border p-3 text-xs ${
                        importResult.failed === 0
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                      }`}
                    >
                      <p className="flex items-center gap-1.5 font-medium">
                        {importResult.failed === 0 ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        )}
                        {t('admin.importResult', {
                          imported: importResult.imported,
                          failed: importResult.failed,
                        })}
                      </p>
                      {importResult.errors.length > 0 && (
                        <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto font-mono text-[10px] text-neutral-400">
                          {importResult.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
