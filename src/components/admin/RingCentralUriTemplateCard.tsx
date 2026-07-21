import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import {
  useRingCentralUriTemplate,
  useSaveRingCentralUriTemplate,
} from '@/hooks/useRingCentralUriTemplate';
import { DEFAULT_RC_SMS_URI_TEMPLATE } from '@/lib/ringcentral/smsUri';

export function RingCentralUriTemplateCard() {
  const { user } = useAuth();
  const { data: current } = useRingCentralUriTemplate();
  const save = useSaveRingCentralUriTemplate();
  const [value, setValue] = useState('');

  useEffect(() => {
    if (current) setValue(current);
  }, [current]);

  const handleSave = async () => {
    try {
      await save.mutateAsync({
        value: value.trim() || DEFAULT_RC_SMS_URI_TEMPLATE,
        updatedBy: user?.name || 'admin',
      });
      toast.success('Saved');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">RingCentral SMS URI template</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label className="text-sm">Deep-link template</Label>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={DEFAULT_RC_SMS_URI_TEMPLATE}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Placeholders: <code>{'{e164}'}</code> for +1XXXXXXXXXX,{' '}
          <code>{'{body}'}</code> for URL-encoded resolved script text. If body
          prefill works on your desktop app, try{' '}
          <code>rcapp://r/sms?type=new&amp;number={'{e164}'}&amp;content={'{body}'}</code>.
        </p>
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
