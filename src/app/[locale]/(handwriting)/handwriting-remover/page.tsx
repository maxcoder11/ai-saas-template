import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { HandwritingWorkspace } from '@/features/handwriting-remover/workspace';

export const metadata: Metadata = {
  title: 'Remove handwriting from worksheets & images | ClearSheet',
  description: 'Clear handwritten notes from worksheets and scanned pages while keeping the original document layout. Upload an image, review the result, and download it.',
  robots: { index: false, follow: false }, // MVP: enable after verifying provider quality.
};

export default async function HandwritingRemoverPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HandwritingWorkspace />;
}
