import { useRef, useState } from 'react';
import { Upload, Check, Loader2 } from 'lucide-react';
import { uploadScreenshot } from '../lib/uploadScreenshot';

interface Props {
  studioSlug: string;
  draftId: string;
  actionType: string;
  value: string | null;
  onUploaded: (url: string) => void;
}

export function ScreenshotUpload({ studioSlug, draftId, actionType, value, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const url = await uploadScreenshot({ studioSlug, draftId, actionType, file });
      onUploaded(url);
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  if (value) {
    return (
      <div className="flex items-center gap-3">
        <img src={value} alt="Uploaded" className="h-16 w-16 rounded object-cover border border-[#3a3a3c]" />
        <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
          <Check className="h-4 w-4" /> Uploaded
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="ml-auto text-xs text-[#F5F2EE]/60 underline min-h-[44px] px-2"
        >
          Replace
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="w-full min-h-[88px] rounded-lg border-2 border-dashed border-[#3a3a3c] hover:border-[#E8540A] bg-[#1f1f21] text-[#F5F2EE]/80 flex flex-col items-center justify-center gap-2 transition cursor-pointer"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
        <span className="text-sm">{loading ? 'Uploading...' : 'Tap to upload screenshot'}</span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
