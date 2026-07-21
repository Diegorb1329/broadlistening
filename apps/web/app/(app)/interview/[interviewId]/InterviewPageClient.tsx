"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function InterviewPageClient({ 
  children, 
  onSearchParams 
}: { 
  children: React.ReactNode;
  onSearchParams: (params: { report?: string }) => void;
}) {
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const report = searchParams.get('report');
    
    onSearchParams({ report: report || undefined });
  }, [searchParams, onSearchParams]);

  if (!mounted) {
    return <div>Loading...</div>;
  }

  return <>{children}</>;
}