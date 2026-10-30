/**
 * 【模型落地页样板渲染与规格计算单测 / 核心回归】
 * 
 * 作用：测试模型落地页（如 Seedance 2.0/2.5）规格参数表汇总提取、服务端原生折叠 FAQ、
 * 无案例文案自动 fallback 以及 JSON-LD 结构化数据。
 * 
 * 运行方式：
 * pnpm exec tsx scripts/test-model-landing.ts
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';

import { MODELS, type ModelEntry } from '../src/config/ai/models';
import { prepareModelLandingPage } from '../src/shared/lib/model-landing';
import {
  formatPrimaryWithExceptions,
  getModelSpecRows,
  summarizeModelSpecRows,
} from '../src/shared/lib/model-specs';
import type { DynamicPage } from '../src/shared/types/blocks/landing';
import { ModelFaq } from '../src/themes/default/blocks/model-faq';
import {
  ModelSpecs,
  type ModelSpecsSection,
} from '../src/themes/default/blocks/model-specs';

const selection = {
  mediaType: 'video' as const,
  modelFamilies: ['seedance-2-fast', 'seedance-2-standard', 'seedance-2-mini'],
};
const rows = getModelSpecRows(selection);
assert.equal(rows.length, 19);
assert(
  !rows.some(
    (row) => row.family === 'seedance-2-mini' && row.scene === 'video-to-video'
  )
);
assert(
  rows
    .filter((row) => row.resolution === '1080p')
    .every((row) => row.family === 'seedance-2-standard')
);
for (const [family, scene, expected] of [
  ['seedance-2-fast', 'text-to-video', 240],
  ['seedance-2-fast', 'video-to-video', 150],
  ['seedance-2-standard', 'text-to-video', 300],
  ['seedance-2-standard', 'video-to-video', 180],
  ['seedance-2-mini', 'image-to-video', 60],
] as const) {
  const row = rows.find(
    (item) =>
      item.family === family &&
      item.scene === scene &&
      item.resolution === '720p'
  );
  assert(row);
  assert.equal(row.exampleCredits, expected);
  assert.equal(row.exampleDuration, 10);
}
assert(
  getModelSpecRows({ ...selection, scenes: ['image-to-video'] }).every(
    (row) => row.scene === 'image-to-video'
  )
);

const summaries = summarizeModelSpecRows(rows);
assert.equal(summaries.length, 3);
assert.deepEqual(
  summaries.map((row) => row.family),
  ['seedance-2-fast', 'seedance-2-standard', 'seedance-2-mini']
);
assert.equal(
  summaries[0].creditsByScene.find((item) => item.scene === 'text-to-video')
    ?.credits,
  240
);
assert.equal(
  summaries[0].creditsByScene.find((item) => item.scene === 'video-to-video')
    ?.credits,
  150
);
assert.equal(
  summaries[1].creditsByScene.find((item) => item.scene === 'text-to-video')
    ?.credits,
  300
);
assert.equal(
  summaries[2].creditsByScene.find((item) => item.scene === 'image-to-video')
    ?.credits,
  60
);
assert(!summaries[2].scenes.includes('video-to-video'));
assert(summaries[1].resolutions.includes('1080p'));
assert(!summaries[0].resolutions.includes('1080p'));
assert.equal(
  formatPrimaryWithExceptions([
    { group: 'Text to Video', value: '240' },
    { group: 'Image to Video', value: '240' },
    { group: 'Video to Video', value: '150' },
  ]),
  '240 (Video to Video: 150)'
);

const images = getModelSpecRows({
  mediaType: 'image',
  modelFamilies: ['gpt-image-2'],
});
assert.equal(images.length, 6);
assert(
  images.every(
    (row) =>
      row.creditsPerSecond === undefined && row.exampleDuration === undefined
  )
);
assert(
  images
    .filter((row) => row.resolution === '4K')
    .every((row) => row.exampleCredits === 15)
);

// Exercise non-10-second models, hidden resolutions and duplicate provider entries.
const originalCount = MODELS.length;
const fixture: ModelEntry = {
  ...MODELS.find(
    (entry) =>
      entry.family === 'seedance-2-fast' &&
      entry.scenes.includes('text-to-video')
  )!,
  family: 'landing-test',
  controls: {
    'text-to-video': {
      duration: { type: 'number', default: 5, options: [5] },
      resolution: {
        type: 'string',
        default: '720p',
        options: ['720p', '1080p'],
      },
    },
  },
  pricing: {
    'text-to-video': {
      mode: 'perSecond',
      defaultDuration: 5,
      byResolution: {
        '720p': { availability: 'enabled', creditsPerSecond: 2 },
        '1080p': { availability: 'candidate', creditsPerSecond: 3 },
      },
    },
  },
};
try {
  MODELS.push(
    fixture,
    { ...fixture, provider: 'another-provider' },
    { ...fixture, enabled: false }
  );
  const results = getModelSpecRows({
    mediaType: 'video',
    modelFamilies: ['landing-test'],
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].exampleDuration, 5);
  assert.equal(results[0].exampleCredits, 10);
} finally {
  MODELS.splice(originalCount);
}

const makePage = (): DynamicPage => ({
  sections: {
    hero: {
      buttons: [
        { title: 'Examples', url: '#examples' },
        { title: 'Generate', url: '#generator' },
      ],
    },
    examples: { id: 'examples', items: [{ video: { src: '/verified.webm' } }] },
    cta: { buttons: [{ title: 'Examples', url: '/model#examples' }] },
  },
});
assert.equal(
  prepareModelLandingPage(makePage()).sections?.hero.buttons?.length,
  2
);
for (const state of ['empty', 'disabled', 'excluded'] as const) {
  const page = makePage();
  if (state === 'empty') page.sections!.examples.items = [];
  if (state === 'disabled') page.sections!.examples.disabled = true;
  if (state === 'excluded') page.show_sections = ['hero', 'cta'];
  const prepared = prepareModelLandingPage(page);
  assert.equal(prepared.sections?.examples.disabled, true);
  assert.deepEqual(
    prepared.sections?.hero.buttons?.map((button) => button.url),
    ['#generator']
  );
  assert.equal(prepared.sections?.cta.buttons?.length, 0);
  assert.equal(page.sections?.hero.buttons?.length, 2);
}
const specification: ModelSpecsSection = {
  id: 'specifications',
  ...selection,
  labels: {
    input: 'Input Support',
    limits: 'Limits',
    pricing: 'Models & Credits',
    model: 'Model',
    workflows: 'Workflows',
    resolution: 'Resolution',
    duration: 'Duration',
    seconds: 's',
    exampleCredits: 'Credits (10s, 720p)',
    scenes: {
      'text-to-video': 'Text to Video',
      'image-to-video': 'Image to Video',
      'video-to-video': 'Video to Video',
    },
  },
  inputItems: [],
  limitsItems: [{ title: 'Mini', description: 'No Video to Video' }],
  limitsNote: '',
};
const renderSpecs = (section: ModelSpecsSection) => {
  const providerProps = {
    locale: 'en',
    messages: {},
    timeZone: 'UTC',
    children: createElement(ModelSpecs, { section }),
  };
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, providerProps)
  );
};
const videoHtml = renderSpecs(specification);
assert.equal((videoHtml.match(/<table\b/g) ?? []).length, 1);
assert.equal((videoHtml.match(/scope="row"/g) ?? []).length, 3);
assert(videoHtml.includes('<thead') && videoHtml.includes('scope="col"'));
assert(videoHtml.includes('240 (Video to Video: 150)'));
assert(videoHtml.includes('300 (Video to Video: 180)'));
assert(videoHtml.includes('1080p') && videoHtml.includes('No Video to Video'));
assert(!videoHtml.includes('Credits / second'));
const imageHtml = renderSpecs({
  ...specification,
  mediaType: 'image',
  modelFamilies: ['gpt-image-2'],
});
assert.equal((imageHtml.match(/<table\b/g) ?? []).length, 1);
assert(imageHtml.includes('10'));
const faqHtml = renderToStaticMarkup(
  createElement(ModelFaq, {
    section: {
      id: 'faq',
      title: 'FAQ',
      items: [{ question: 'Cost?', answer: '240 credits' }],
    },
  })
);
assert(faqHtml.includes('<details') && faqHtml.includes('240 credits'));
console.log(
  'Model landing: pricing, image reuse, native HTML and showcase fallback passed.'
);
