import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { motion, useReducedMotion } from 'framer-motion';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { usePerformanceMode } from '../hooks/usePerformanceMode';

type ContentItem = {
  id: string;
  title: string;
  summary?: string | null;
  category: string;
  external_url: string;
  source?: string | null;
  image_url?: string | null;
  published?: boolean;
  featured?: boolean;
  sort_order?: number;
  published_at?: string | null;
  created_at?: string | null;
};

const categoryOptions = [
  { value: 'all', label: 'All updates' },
  { value: 'news', label: 'News' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'notice', label: 'Notice' },
  { value: 'report', label: 'Report' },
  { value: 'past-events', label: 'Past events' },
  { value: 'article', label: 'Article' },
  { value: 'blog', label: 'Blog' }
];

const categoryMeta: Record<string, { label: string; tone: string; icon: string }> = {
  news: { label: 'News', tone: 'bg-cyan-50 text-cyan-700 border-cyan-100', icon: 'solar:newspaper-bold' },
  announcement: { label: 'Announcement', tone: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: 'solar:notification-unread-bold' },
  notice: { label: 'Notice', tone: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'solar:shield-warning-bold' },
  report: { label: 'Report', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'solar:document-text-bold' },
  'past-events': { label: 'Past Event', tone: 'bg-violet-50 text-violet-700 border-violet-100', icon: 'solar:calendar-bold' },
  article: { label: 'Article', tone: 'bg-sky-50 text-sky-700 border-sky-100', icon: 'solar:book-bold' },
  blog: { label: 'Blog', tone: 'bg-rose-50 text-rose-700 border-rose-100', icon: 'solar:pen-bold' }
};

const fallbackMeta = { label: 'Update', tone: 'bg-gray-50 text-gray-600 border-gray-200', icon: 'solar:link-bold' };

const formatDate = (value?: string | null) => {
  if (!value) return 'Recently posted';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently posted';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const getCategoryMeta = (category: string) => categoryMeta[category] || fallbackMeta;

const News = () => {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [error, setError] = useState('');
  const prefersReduced = useReducedMotion();
  const { reduceMotion } = usePerformanceMode();
  const compactMotion = prefersReduced || reduceMotion;

  useEffect(() => {
    const controller = new AbortController();

    const fetchItems = async () => {
      try {
        setLoading(true);
        setError('');
        const query = selectedCategory === 'all' ? '' : `?category=${encodeURIComponent(selectedCategory)}`;
        const res = await fetch(`/api/content${query}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load updates');
        setItems(data.items || []);
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Failed to load updates');
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
    return () => controller.abort();
  }, [selectedCategory]);

  const featuredItems = useMemo(() => items.filter((item) => item.featured).slice(0, 3), [items]);
  const visibleItems = items;

  const motionProps = compactMotion
    ? {}
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.25 } };

  return (
    <div className="space-y-8 pb-20">
      <motion.header
        {...motionProps}
        className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.16),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.12),_transparent_28%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.95))]" />
        <div className="relative p-6 md:p-8 lg:p-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-2xl space-y-4">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-100 bg-cyan-50 text-cyan-700 text-[10px] font-bold uppercase tracking-[0.28em]">
                <Icon icon="solar:square-top-down-bold" fontSize={14} />
                News hub
              </span>
              <div className="space-y-3">
                <h1 className="text-3xl md:text-5xl font-black tracking-tight text-[#1A2230]">
                  News, notices, reports, articles, and blogs in one calm feed.
                </h1>
                <p className="text-sm md:text-base text-gray-500 leading-7 max-w-2xl">
                  Admins can publish external links, announcements, notices, and post-event writeups here.
                  Each card takes users straight to the source while keeping the TechSphere experience fast and breathable.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="min-w-24 rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-sm">
                <div className="text-[10px] uppercase tracking-[0.28em] text-gray-400 font-bold">Total</div>
                <div className="mt-2 text-2xl font-black text-[#1A2230]">{items.length}</div>
              </div>
              <div className="min-w-24 rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-sm">
                <div className="text-[10px] uppercase tracking-[0.28em] text-gray-400 font-bold">Featured</div>
                <div className="mt-2 text-2xl font-black text-[#1A2230]">{featuredItems.length}</div>
              </div>
              <div className="min-w-24 rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-sm">
                <div className="text-[10px] uppercase tracking-[0.28em] text-gray-400 font-bold">Live</div>
                <div className="mt-2 text-2xl font-black text-[#1A2230]">{selectedCategory === 'all' ? 'All' : getCategoryMeta(selectedCategory).label}</div>
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {categoryOptions.map((category) => {
          const active = selectedCategory === category.value;
          return (
            <button
              key={category.value}
              onClick={() => setSelectedCategory(category.value)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.24em] transition-all border ${
                active
                  ? 'bg-[#1A2230] text-white border-[#1A2230] shadow-md shadow-gray-200'
                  : 'bg-white text-gray-500 border-gray-100 hover:text-[#1A2230] hover:border-gray-200'
              }`}
            >
              {category.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-red-700 text-sm font-medium">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
              <Skeleton className="h-44 w-full rounded-none" />
              <div className="p-5 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <div className="flex items-center justify-between pt-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-28" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : visibleItems.length > 0 ? (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
          initial={compactMotion ? false : 'hidden'}
          animate={compactMotion ? undefined : 'show'}
          variants={{
            hidden: {},
            show: {
              transition: { staggerChildren: 0.06 }
            }
          }}
        >
          {visibleItems.map((item) => {
            const meta = getCategoryMeta(item.category);

            return (
              <motion.a
                key={item.id}
                href={item.external_url}
                target="_blank"
                rel="noreferrer"
                className="group overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-gray-200/60 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                whileHover={compactMotion ? undefined : { y: -4 }}
                variants={compactMotion ? undefined : {
                  hidden: { opacity: 0, y: 14 },
                  show: { opacity: 1, y: 0 }
                }}
              >
                <div className="relative h-44 overflow-hidden bg-gray-100">
                  <img
                    src={item.image_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80'}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#111827]/60 via-transparent to-transparent" />
                  <div className="absolute left-4 top-4 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] ${meta.tone}`}>
                      <Icon icon={meta.icon} fontSize={12} />
                      {meta.label}
                    </span>
                    {item.featured && (
                      <span className="inline-flex items-center rounded-full border border-white/20 bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#1A2230]">
                        Featured
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div className="space-y-2">
                    <h2 className="text-lg font-bold tracking-tight text-[#1A2230] group-hover:text-indigo-700 transition-colors">
                      {item.title}
                    </h2>
                    <p className="text-sm leading-6 text-gray-500 line-clamp-3">
                      {item.summary || 'Open the external link to read the full update.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-gray-400">
                    {item.source && (
                      <span className="rounded-full bg-gray-50 px-3 py-1 border border-gray-100">
                        {item.source}
                      </span>
                    )}
                    <span className="rounded-full bg-gray-50 px-3 py-1 border border-gray-100">
                      {formatDate(item.published_at || item.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-gray-400">
                      External source
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#1A2230] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.24em] text-white">
                      Open
                      <Icon icon="solar:arrow-up-right-bold" fontSize={14} />
                    </span>
                  </div>
                </div>
              </motion.a>
            );
          })}
        </motion.div>
      ) : (
        <EmptyState
          icon="solar:notebook-bold"
          title="No updates published yet"
          description="When an admin adds a news item, notice, blog, report, or past-event writeup, it will appear here and link out to the source."
        />
      )}
    </div>
  );
};

export default News;
