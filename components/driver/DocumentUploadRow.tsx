"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, CheckCircle2, Upload, FileText } from "lucide-react";

export function DocumentUploadRow({
  userId,
  storageKey,
  label,
  hint,
  existingPath,
  onUploaded,
}: {
  userId: string;
  storageKey: string; // e.g. "id-document"
  label: string;
  hint: string;
  existingPath: string | null;
  onUploaded: (path: string) => void;
}) {
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!existingPath) {
      setPreviewUrl(null);
      return;
    }
    supabase.storage
      .from("driver-documents")
      .createSignedUrl(existingPath, 300)
      .then(({ data }) => setPreviewUrl(data?.signedUrl || null));
  }, [existingPath, supabase]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${storageKey}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from("driver-documents").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });

    setUploading(false);

    if (uploadErr) {
      setError(uploadErr.message);
      return;
    }

    onUploaded(path);
  }

  return (
    <div className="border border-navy-100 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="font-semibold text-sm">{label}</p>
        {existingPath && (
          <span className="pill bg-jade-50 text-jade-600">
            <CheckCircle2 className="w-3.5 h-3.5" /> Uploaded
          </span>
        )}
      </div>
      <p className="text-xs text-navy-400 mb-3">{hint}</p>

      {previewUrl && (
        <a href={previewUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-navy-500 mb-3 hover:underline">
          <FileText className="w-3.5 h-3.5" /> View current upload
        </a>
      )}

      <label className="btn-ghost w-full cursor-pointer !py-2 text-sm">
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {existingPath ? "Replace file" : "Upload file"}
        <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} disabled={uploading} />
      </label>

      {error && <p className="text-xs text-coral-600 mt-2">{error}</p>}
    </div>
  );
}
