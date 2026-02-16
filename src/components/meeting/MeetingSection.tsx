import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MeetingSectionProps {
  title: string;
  icon: React.ReactNode;
  sectionId: string;
  isPresentMode: boolean;
  children: React.ReactNode;
  hidden?: boolean;
}

export function MeetingSection({ title, icon, sectionId, isPresentMode, children, hidden }: MeetingSectionProps) {
  if (hidden) return null;

  if (isPresentMode) {
    return (
      <div
        id={sectionId}
        className="min-h-screen flex flex-col items-center justify-center px-8 py-12"
      >
        <h2 className="text-4xl md:text-5xl font-bold mb-8 flex items-center gap-4 text-white">
          {icon}
          {title}
        </h2>
        <div className="w-full max-w-5xl">{children}</div>
      </div>
    );
  }

  return (
    <Card id={sectionId}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
