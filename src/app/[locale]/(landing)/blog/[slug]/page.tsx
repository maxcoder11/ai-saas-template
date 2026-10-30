import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { envConfigs } from '@/config';
import { JsonLd } from '@/shared/components/seo/json-ld';
import {
  buildArticleSchema,
  buildBreadcrumbSchema,
} from '@/shared/lib/schema';
import { getPost } from '@/shared/models/post';
import { DynamicPage } from '@/shared/types/blocks/landing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = await getTranslations('pages.blog.metadata');

  const canonicalUrl =
    locale !== envConfigs.locale
      ? `${envConfigs.app_url}/${locale}/blog/${slug}`
      : `${envConfigs.app_url}/blog/${slug}`;

  const post = await getPost({ slug, locale });
  if (!post) {
    return {
      title: `${slug} | ${t('title')}`,
      description: t('description'),
      alternates: {
        canonical: canonicalUrl,
      },
    };
  }

  return {
    title: `${post.title} | ${t('title')}`,
    description: post.description,
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const post = await getPost({ slug, locale });

  if (!post) {
    notFound();
  }

  // build page sections
  const page: DynamicPage = {
    sections: {
      blogDetail: {
        block: 'blog-detail',
        data: {
          post,
        },
      },
    },
  };

  const Page = await getThemePage('dynamic-page');

  const appUrl = envConfigs.app_url;
  const postUrl =
    locale !== envConfigs.locale
      ? `${appUrl}/${locale}/blog/${slug}`
      : `${appUrl}/blog/${slug}`;

  return (
    <>
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Home', url: appUrl },
          { name: 'Blog', url: `${appUrl}/blog` },
          { name: post.title || slug, url: postUrl },
        ])}
      />
      <JsonLd
        data={buildArticleSchema({
          title: post.title || '',
          url: postUrl,
          datePublished: post.created_at || '',
          authorName: post.author_name || envConfigs.app_name,
          description: post.description,
        })}
      />
      <Page locale={locale} page={page} />
    </>
  );
}
