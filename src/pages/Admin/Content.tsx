import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Icon } from '@iconify/react';
import supabase from '../../lib/supabase';
import { Skeleton } from '../../components/Skeleton';
import { usePerformanceMode } from '../../hooks/usePerformanceMode';

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
  updated_at?: string | null;
};

type ContentFormState = {
  title: string;
  summary: string;
  category: string;
  external_url: string;
  source: string;
  image_url: string;
  published: boolean;
  featured: boolean;
  sort_order: string;
  published_at: string;
};

const categoryOptions = [
  { value: 'news', label: 'News' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'notice', label: 'Notice' },
  { value: 'report', label: 'Report' },
  { value: 'past-events', label: 'Past events' },
  { value: 'article', label: 'Article' },
  { value: 'blog', label: 'Blog' }
];

const emptyForm = (): ContentFormState => ({
  title: '',
  summary: '',
  category: 'news',
  external_url: '',
  source: '',
  image_url: '',
  published: true,
  featured: false,
  sort_order: '0',
  published_at: ''
});

const formatDateInput = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Draft';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Draft';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const AdminContent = () => {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [form, setForm] = useState<ContentFormState>(emptyForm());
  const { reduceMotion } = usePerformanceMode();

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError('');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in again to manage content.');

      const query = filter === 'all' ? '' : `?category=${encodeURIComponent(filter)}`;
      const res = await fetch(`/api/admin-content${query}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load content');
      setItems(data.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [filter]);

  const totals = useMemo(() => ({
    total: items.length,
    published: items.filter((item) => item.published).length,
    featured: items.filter((item) => item.featured).length
  }), [items]);

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (item: ContentItem) => {
    setEditingItem(item);
    setForm({
      title: item.title || '',
      summary: item.summary || '',
      category: item.category || 'news',
      external_url: item.external_url || '',
      source: item.source || '',
      image_url: item.image_url || '',
      published: Boolean(item.published),
      featured: Boolean(item.featured),
      sort_order: String(item.sort_order ?? 0),
      published_at: formatDateInput(item.published_at || item.created_at || null)
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingItem(null);
    setForm(emptyForm());
  };

  const saveItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in again to manage content.');

      const payload = {
        title: form.title.trim(),
        summary: form.summary.trim(),
        category: form.category.trim(),
        external_url: form.external_url.trim(),
        source: form.source.trim(),
        image_url: form.image_url.trim(),
        published: form.published,
        featured: form.featured,
        sort_order: Number(form.sort_order || 0),
        published_at: form.published_at ? new Date(form.published_at).toISOString() : null
      };

      const res = await fetch('/api/admin-content', {
        method: editingItem ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: editingItem
          ? JSON.stringify({ id: editingItem.id, updates: payload })
          : JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save content');

      closeModal();
      await fetchItems();
    } catch (err: any) {
      alert(err.message || 'Failed to save content');
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (item: ContentItem) => {
    if (!confirm(`Delete "${item.title}"?`)) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in again to manage content.');

      const res = await fetch(`/api/admin-content?id=${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete content');

      setItems((prev) => prev.filter((row) => row.id !== item.id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete content');
    }
  };

  const togglePublished = async (item: ContentItem, published: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in again to manage content.');

      const res = await fetch('/api/admin-content', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id: item.id, updates: { published } })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');

      setItems((prev) => prev.map((row) => (row.id === item.id ? data.item : row)));
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const copyLink = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      alert('Copy failed. Please copy the URL manually.');
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <header className={`flex flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm ${reduceMotion ? '' : 'lg:flex-row lg:items-end lg:justify-between'}`}>
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-indigo-700">
            <Icon icon="solar:window-frame-bold" fontSize={14} />
            Admin content hub
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[#1A2230]">Manage news, notices, articles, and external updates</h1>
          <p className="text-sm leading-7 text-gray-500">
            Create calm, fast external-link cards for announcements, reports, blogs, and past events. Only admins can add or edit these entries.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1A2230] px-5 py-3 text-sm font-bold uppercase tracking-[0.22em] text-white shadow-lg shadow-gray-200 transition-transform hover:-translate-y-0.5"
        >
          <Icon icon="solar:add-circle-bold" fontSize={18} />
          New item
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-gray-400">Total</div>
          <div className="mt-2 text-3xl font-black text-[#1A2230]">{totals.total}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-gray-400">Published</div>
          <div className="mt-2 text-3xl font-black text-[#1A2230]">{totals.published}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-gray-400">Featured</div>
          <div className="mt-2 text-3xl font-black text-[#1A2230]">{totals.featured}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {['all', ...categoryOptions.map((item) => item.value)].map((value) => {
          const active = filter === value;
          const label = value === 'all'
            ? 'All items'
            : categoryOptions.find((item) => item.value === value)?.label || value;

          return (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.24em] transition-all ${
                active
                  ? 'border-[#1A2230] bg-[#1A2230] text-white shadow-md shadow-gray-200'
                  : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200 hover:text-[#1A2230]'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="rounded-3xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <Skeleton className="h-44 w-full rounded-none" />
              <div className="space-y-3 p-5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-6 w-4/5" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <div className="flex items-center justify-between pt-3">
                  <Skeleton className="h-9 w-28" />
                  <Skeleton className="h-9 w-28" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {items.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
              <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
                <div className="h-32 w-full overflow-hidden rounded-2xl bg-gray-100 md:h-28 md:w-44 md:shrink-0">
                  <img
                    src={item.image_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80'}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-indigo-700">
                      {item.category}
                    </span>
                    {item.featured ? (
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-amber-700">
                        Featured
                      </span>
                    ) : null}
                    <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] ${item.published ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {item.published ? 'Published' : 'Draft'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-xl font-bold tracking-tight text-[#1A2230]">{item.title}</h2>
                    <p className="line-clamp-2 text-sm leading-6 text-gray-500">{item.summary || 'No summary provided.'}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-gray-400">
                    {item.source ? (
                      <span className="rounded-full border border-gray-100 bg-gray-50 px-3 py-1">
                        {item.source}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-gray-100 bg-gray-50 px-3 py-1">
                      {formatDate(item.published_at || item.created_at)}
                    </span>
                    <span className="rounded-full border border-gray-100 bg-gray-50 px-3 py-1">
                      Sort {item.sort_order ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4">
                <a
                  href={item.external_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#1A2230] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-white"
                >
                  Open
                  <Icon icon="solar:arrow-up-right-bold" fontSize={14} />
                </a>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyLink(item.external_url)}
                    className="rounded-full border border-gray-100 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    Copy link
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePublished(item, !item.published)}
                    className="rounded-full border border-gray-100 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    {item.published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-indigo-700 transition-colors hover:bg-indigo-100"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item)}
                    className="rounded-full border border-red-100 bg-red-50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-red-600 transition-colors hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <Icon icon="solar:document-add-bold" fontSize={40} className="mx-auto text-gray-300" />
          <h2 className="mt-4 text-xl font-bold text-[#1A2230]">No content items yet</h2>
          <p className="mt-2 text-sm text-gray-500">Create the first announcement, notice, report, or external article link.</p>
          <button
            onClick={openCreate}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#1A2230] px-5 py-3 text-sm font-bold uppercase tracking-[0.22em] text-white"
          >
            <Icon icon="solar:add-circle-bold" fontSize={18} />
            Create item
          </button>
        </div>
      )}

      {modalOpen && createPortal(
        <div className="fixed inset-0 z-[120] overflow-y-auto bg-[#111827]/70 p-4 backdrop-blur-sm">
          <div className="mx-auto my-10 w-full max-w-4xl rounded-3xl border border-white/10 bg-white shadow-2xl">
            <form onSubmit={saveItem} className="space-y-8 p-6 md:p-8">
              <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-gray-400">Content item</p>
                  <h2 className="text-2xl font-black tracking-tight text-[#1A2230]">
                    {editingItem ? 'Edit update' : 'Create update'}
                  </h2>
                </div>
                <button type="button" onClick={closeModal} className="rounded-full border border-gray-200 p-2 text-gray-500 hover:bg-gray-50">
                  <Icon icon="solar:close-circle-bold" fontSize={22} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-gray-400">Title</span>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
                    placeholder="Add a clear headline"
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-gray-400">Summary</span>
                  <textarea
                    rows={4}
                    value={form.summary}
                    onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
                    placeholder="Short description shown on the card"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-gray-400">Category</span>
                  <input
                    list="content-categories"
                    value={form.category}
                    onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
                    placeholder="news, announcement, notice..."
                  />
                  <datalist id="content-categories">
                    {categoryOptions.map((option) => (
                      <option key={option.value} value={option.value} />
                    ))}
                  </datalist>
                </label>

                <label className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-gray-400">External URL</span>
                  <input
                    required
                    type="url"
                    value={form.external_url}
                    onChange={(e) => setForm((prev) => ({ ...prev, external_url: e.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
                    placeholder="https://example.com/story"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-gray-400">Source label</span>
                  <input
                    value={form.source}
                    onChange={(e) => setForm((prev) => ({ ...prev, source: e.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
                    placeholder="TechSphere blog, IEEE, etc."
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-gray-400">Cover image URL</span>
                  <input
                    value={form.image_url}
                    onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
                    placeholder="Optional image for the card"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-gray-400">Published at</span>
                  <input
                    type="datetime-local"
                    value={form.published_at}
                    onChange={(e) => setForm((prev) => ({ ...prev, published_at: e.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-gray-400">Sort order</span>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
                    placeholder="0"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(e) => setForm((prev) => ({ ...prev, published: e.target.checked }))}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  Published
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(e) => setForm((prev) => ({ ...prev, featured: e.target.checked }))}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  Featured
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold uppercase tracking-[0.2em] text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#1A2230] px-5 py-3 text-sm font-bold uppercase tracking-[0.2em] text-white disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editingItem ? 'Update item' : 'Create item'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminContent;
