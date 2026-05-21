import { useRef, useState } from 'react';
import { Upload, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { uploadScreenshot } from '../lib/uploadScreenshot';

interface Props {
  studioSlug: string;
  draftId: string;
  actionType: string;
  value: string | null;
  onUploaded: (url: string) => void;
  label?: string;
  /** If true, clicking shows a toast instead of opening the file picker. Used in /admin preview. */
  previewMode?: boolean;
}

export function ScreenshotUpload({ studioSlug, draftId, actionType, value, onUploaded, label, previewMode }: Props) {
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

  const handleClick = () => {
    if (previewMode) {
      toast('Uploads disabled in preview mode.');
      return;
    }
    inputRef.current?.click();
  };

  if (value) {
    return (
      <div className="flex items-center gap-3">
        <img src={value} alt="Uploaded" className="h-16 w-16 rounded object-cover border border-[#3a3a3c]" />
        <div className="font-display font-bold text-[#4CAF50] text-sm flex items-center gap-1.5">
          <Check className="h-4 w-4" /> Verified
        </div>
        <button
          type="button"
          onClick={handleClick}
          className="ml-auto text-xs text-[#F5F2EE]/60 underline min-h-[44px] px-2 font-body cursor-pointer"
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
        onClick={handleClick}
        disabled={loading}
        className="w-full min-h-[88px] rounded-lg border-2 border-dashed border-[#3a3a3c] hover:border-[#E8540A] bg-[#1f1f21] text-[#8E8E93] flex flex-col items-center justify-center gap-2 transition cursor-pointer"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
        <span className="font-body font-medium text-[13px]">{loading ? 'Uploading...' : (label || 'Tap to upload screenshot')}</span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      {error && <p className="text-xs text-red-400 mt-1 font-body">{error}</p>}
    </div>
  );
}
