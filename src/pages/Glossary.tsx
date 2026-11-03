/**
 * Glossary: photography and video terms, each explained in plain words and in
 * depth. Searchable in both languages and filterable by topic.
 */
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { CATEGORY_LABELS, GLOSSARY, type GlossaryCategory, type GlossaryEntry } from '../data/glossary';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as GlossaryCategory[];

function normalise(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function haystack(e: GlossaryEntry): string {
  return normalise([e.term.en, e.term.sw, e.simple.en, e.simple.sw, e.advanced.en, e.advanced.sw].join(' '));
}

const INDEX = GLOSSARY.map((e) => ({ entry: e, text: haystack(e), term: normalise(`${e.term.en} ${e.term.sw}`) }));

export default function Glossary() {
  const { t, pick } = useI18n();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<GlossaryCategory | 'all'>('all');

  // The page is lazy-loaded, so the browser's own jump to #term happens
  // before the entries exist. Do it once they have rendered.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  const results = useMemo(() => {
    const q = normalise(query.trim());
    const inCategory = INDEX.filter((i) => category === 'all' || i.entry.category === category);
    if (!q) return inCategory.map((i) => i.entry);
    // Matches in the term itself come first, then matches in the explanations.
    const termHits = inCategory.filter((i) => i.term.includes(q));
    const textHits = inCategory.filter((i) => !i.term.includes(q) && i.text.includes(q));
    return [...termHits, ...textHits].map((i) => i.entry);
  }, [query, category]);

  const grouped = !query.trim();
  const sections = grouped
    ? CATEGORIES.map((c) => ({ c, items: results.filter((e) => e.category === c) })).filter((s) => s.items.length > 0)
    : [{ c: null, items: results }];

  return (
    <div className="content-page glossary">
      <h1>{t('navGlossary')}</h1>
      <p>{t('glossaryIntro')}</p>

      <div className="glossary-tools">
        <input
          type="search"
          aria-label={t('glossarySearch')}
          placeholder={t('glossarySearch')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="glossary-search"
        />
        <div className="glossary-cats" role="group" aria-label={t('glossarySearch')}>
          {(['all', ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              className={`chip ${category === c ? 'active' : ''}`}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {c === 'all' ? t('glossaryAll') : pick(CATEGORY_LABELS[c])}
            </button>
          ))}
        </div>
        <p className="glossary-count" role="status" data-testid="glossary-count">
          {results.length} {t('glossaryTerms')}
        </p>
      </div>

      {results.length === 0 && <p>{t('glossaryNoMatch')}</p>}

      {sections.map(({ c, items }) => (
        <section key={c ?? 'results'} aria-labelledby={c ? `gloss-cat-${c}` : undefined}>
          {c && <h2 id={`gloss-cat-${c}`}>{pick(CATEGORY_LABELS[c])}</h2>}
          <dl className="glossary-list">
            {items.map((e) => (
              <div key={e.id} id={e.id} className="card glossary-entry" data-testid="glossary-entry">
                <dt>{pick(e.term)}</dt>
                <dd>
                  <p><span className="glossary-label">{t('glossaryPlain')}</span> {pick(e.simple)}</p>
                  <p><span className="glossary-label depth">{t('glossaryDepth')}</span> {pick(e.advanced)}</p>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
