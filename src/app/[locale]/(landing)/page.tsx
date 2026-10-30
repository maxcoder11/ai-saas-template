import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { envConfigs } from '@/config';
import { VideoGenerator } from '@/shared/blocks/generator';
import { JsonLd } from '@/shared/components/seo/json-ld';
import { buildVideoSchema } from '@/shared/lib/schema';
import { getMetadata } from '@/shared/lib/seo';
import { DynamicPage, Section } from '@/shared/types/blocks/landing';

/** Home locale JSON section order; dynamic-page uses Object.keys insertion order. */
const HOME_SECTION_ORDER = [
  'hero',
  'generator',
  'showcases',
  'features',
  'useCases',
  'howTo',
  'update',
  'pricing',
  'faq',
  'cta',
] as const;

function buildHomeSections(
  rawSections: Record<string, Section>,
  generatorSection: Section
): Record<string, Section> {
  const sections: Record<string, Section> = {};
  for (const key of HOME_SECTION_ORDER) {
    if (key === 'generator') {
      sections.generator = generatorSection;
    } else if (rawSections[key]) {
      sections[key] = rawSections[key];
    }
  }
  for (const key of Object.keys(rawSections)) {
    if (!sections[key]) {
      sections[key] = rawSections[key];
    }
  }
  return sections;
}

export const generateMetadata = getMetadata({
  metadataKey: 'pages.index.metadata',
  canonicalUrl: '/',
});

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('pages.index');
  const rawPage: DynamicPage = t.raw('page');
  const rawSections = rawPage.sections ?? {};

  const page: DynamicPage = {
    ...rawPage,
    sections: buildHomeSections(rawSections, {
      component: (
        <div id="generator" className="scroll-mt-20">
          <VideoGenerator
            className="py-8 md:py-10"
            srOnlyTitle={t.raw('generator.title')}
          />
        </div>
      ),
    }),
  };

  const videoSchemas = (page.sections?.showcases?.items ?? []).flatMap(
    (item) => {
      const video = item.video;
      const thumbnailPath = item.image?.src;

      if (
        !item.title ||
        !item.description ||
        !video?.src ||
        !video.uploadDate ||
        !thumbnailPath
      ) {
        return [];
      }

      return [
        buildVideoSchema({
          name: item.title,
          description: item.description,
          thumbnailUrl: new URL(thumbnailPath, envConfigs.app_url).toString(),
          uploadDate: video.uploadDate,
          contentUrl: new URL(video.src, envConfigs.app_url).toString(),
          duration: video.duration,
        }),
      ];
    }
  );

  const Page = await getThemePage('dynamic-page');

  return (
    <>
      {videoSchemas.map((videoSchema) => (
        <JsonLd key={videoSchema.contentUrl} data={videoSchema} />
      ))}
      <Page locale={locale} page={page} />
    </>
  );
}
