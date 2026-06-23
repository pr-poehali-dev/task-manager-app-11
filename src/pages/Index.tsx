import { useState, useMemo, useEffect, useRef } from 'react';
import Icon from '@/components/ui/icon';

type Priority = 'low' | 'medium' | 'high';
type Status = 'todo' | 'inprogress' | 'done';
type Section = 'tasks' | 'calendar' | 'analytics' | 'archive';
type ReminderOffset = 'none' | 'at' | '10min' | '30min' | '1hour' | '1day';

interface Task {
  id: number;
  title: string;
  note?: string;
  due: string;
  priority: Priority;
  status: Status;
  tags: string[];
  done: boolean;
  archived: boolean;
  reminderAt?: string; // ISO datetime строка
  reminderFired?: boolean;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const initialTasks: Task[] = [
  { id: 1, title: 'Подготовить презентацию для клиента', note: 'Слайды + смета', due: addDays(-1), priority: 'high', status: 'inprogress', tags: ['#дизайн'], done: false, archived: false },
  { id: 2, title: 'Созвон с командой дизайна', due: todayISO(), priority: 'medium', status: 'todo', tags: ['#встреча'], done: false, archived: false },
  { id: 3, title: 'Ответить на письма', due: todayISO(), priority: 'low', status: 'done', tags: [], done: true, archived: false },
  { id: 4, title: 'Запланировать спринт', note: 'Распределить задачи', due: addDays(2), priority: 'high', status: 'todo', tags: ['#frontend'], done: false, archived: false },
  { id: 5, title: 'Обновить документацию', due: addDays(5), priority: 'low', status: 'todo', tags: [], done: false, archived: false },
  { id: 6, title: 'Релиз версии 2.0', due: addDays(-3), priority: 'high', status: 'done', tags: [], done: true, archived: true },
];

const priorityMeta: Record<Priority, { label: string; dot: string; bg: string; border: string; text: string }> = {
  high:   { label: 'Высокий', dot: 'bg-destructive', bg: 'bg-destructive/8',  border: 'border-destructive/30', text: 'text-destructive' },
  medium: { label: 'Средний', dot: 'bg-amber-500',   bg: 'bg-amber-50',       border: 'border-amber-300',      text: 'text-amber-700' },
  low:    { label: 'Низкий',  dot: 'bg-emerald-500', bg: 'bg-emerald-50',     border: 'border-emerald-300',    text: 'text-emerald-700' },
};

const statusMeta: Record<Status, { label: string; bg: string; border: string; text: string }> = {
  todo:       { label: 'К выполнению', bg: 'bg-blue-50',    border: 'border-blue-300',    text: 'text-blue-700' },
  inprogress: { label: 'В процессе',   bg: 'bg-orange-50',  border: 'border-orange-300',  text: 'text-orange-700' },
  done:       { label: 'Выполнено',    bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700' },
};

const REMINDER_OPTIONS: { value: ReminderOffset; label: string }[] = [
  { value: 'none',   label: 'Без уведомления' },
  { value: 'at',     label: 'В момент срока' },
  { value: '10min',  label: 'За 10 минут' },
  { value: '30min',  label: 'За 30 минут' },
  { value: '1hour',  label: 'За 1 час' },
  { value: '1day',   label: 'За 1 день' },
];

const navItems: { id: Section; label: string; icon: string }[] = [
  { id: 'tasks',     label: 'Задачи',    icon: 'ListChecks' },
  { id: 'calendar',  label: 'Календарь', icon: 'Calendar' },
  { id: 'analytics', label: 'Аналитика', icon: 'BarChart3' },
  { id: 'archive',   label: 'Архив',     icon: 'Archive' },
];

const PRESET_TAGS = ['#дизайн', '#встреча', '#frontend', '#срочно', '#идея'];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const calcReminderAt = (dueDate: string, dueTime: string, offset: ReminderOffset): string | undefined => {
  if (offset === 'none' || !dueDate) return undefined;
  const time = dueTime || '09:00';
  const dueMs = new Date(`${dueDate}T${time}`).getTime();
  const offsets: Record<ReminderOffset, number> = {
    none: 0, at: 0, '10min': 10 * 60_000, '30min': 30 * 60_000, '1hour': 60 * 60_000, '1day': 24 * 60 * 60_000,
  };
  return new Date(dueMs - offsets[offset]).toISOString();
};

const emptyForm = () => ({
  title: '',
  note: '',
  priority: 'medium' as Priority,
  status: 'todo' as Status,
  due: '',
  dueTime: '',
  reminderOffset: 'none' as ReminderOffset,
  tagInput: '',
  tags: [] as string[],
});

// Запрашиваем разрешение на уведомления
const requestNotifPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
};

export default function Index() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [section, setSection] = useState<Section>('tasks');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  // Внутриприложенческий тост для уведомлений
  const [toast, setToast] = useState<{ title: string; id: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active   = tasks.filter((t) => !t.archived);
  const overdue  = active.filter((t) => !t.done && t.due < todayISO());
  const upcoming = active.filter((t) => !t.done && t.due >= todayISO() && t.due <= addDays(2));

  // Тикер — каждые 30 сек проверяем напоминания
  useEffect(() => {
    requestNotifPermission();
    const tick = () => {
      const now = Date.now();
      setTasks((prev) =>
        prev.map((t) => {
          if (!t.reminderAt || t.reminderFired || t.done) return t;
          if (new Date(t.reminderAt).getTime() <= now) {
            // Браузерное уведомление
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('⏰ Напоминание — Focus', { body: t.title, icon: '/favicon.svg' });
            }
            // Внутриприложенческий тост
            setToast({ title: t.title, id: t.id });
            if (toastTimer.current) clearTimeout(toastTimer.current);
            toastTimer.current = setTimeout(() => setToast(null), 6000);
            return { ...t, reminderFired: true };
          }
          return t;
        })
      );
    };
    tick();
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, []);

  const toggle  = (id: number) => setTasks((p) => p.map((t) => t.id === id ? { ...t, done: !t.done, status: !t.done ? 'done' : 'todo' } : t));
  const archive = (id: number) => setTasks((p) => p.map((t) => t.id === id ? { ...t, archived: true, done: true } : t));
  const restore = (id: number) => setTasks((p) => p.map((t) => t.id === id ? { ...t, archived: false } : t));

  const openModal  = () => { setForm(emptyForm()); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);

  const addTagFromInput = () => {
    const tag = form.tagInput.trim().replace(/^#*/, '#');
    if (tag.length > 1 && !form.tags.includes(tag)) {
      setForm((f) => ({ ...f, tags: [...f.tags, tag], tagInput: '' }));
    } else {
      setForm((f) => ({ ...f, tagInput: '' }));
    }
  };

  const togglePresetTag = (tag: string) => {
    setForm((f) => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag] }));
  };

  const createTask = () => {
    if (!form.title.trim()) return;
    const reminderAt = calcReminderAt(form.due, form.dueTime, form.reminderOffset);
    setTasks((p) => [
      ...p,
      {
        id: Date.now(),
        title: form.title.trim(),
        note: form.note.trim() || undefined,
        due: form.due || todayISO(),
        priority: form.priority,
        status: form.status,
        tags: form.tags,
        done: form.status === 'done',
        archived: false,
        reminderAt,
        reminderFired: false,
      },
    ]);
    closeModal();
  };

  const stats = useMemo(() => {
    const total = active.length;
    const done  = active.filter((t) => t.done).length;
    return { total, done, pending: total - done, overdue: overdue.length, rate: total ? Math.round((done / total) * 100) : 0 };
  }, [active, overdue]);

  return (
    <div className="min-h-screen flex bg-background text-foreground">

      {/* Sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border px-5 py-8">
        <div className="flex items-center gap-2 mb-12 px-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Icon name="Check" size={18} className="text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">Focus</span>
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map((n) => (
            <button key={n.id} onClick={() => setSection(n.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                section === n.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}>
              <Icon name={n.icon} size={18} />
              {n.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto px-3 py-3 rounded-xl bg-secondary/60">
          <p className="text-xs text-muted-foreground mb-1">Выполнено сегодня</p>
          <p className="text-2xl font-bold">{stats.rate}%</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10 md:py-14">
        <header className="mb-8 flex items-end justify-between animate-fade-in">
          <div>
            <p className="font-hand text-2xl text-muted-foreground mb-1">
              {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight">
              {navItems.find((n) => n.id === section)?.label}
            </h1>
          </div>
          {section === 'tasks' && (
            <button onClick={openModal}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition">
              <Icon name="Plus" size={16} />
              Новая задача
            </button>
          )}
        </header>

        {/* Reminders */}
        {(overdue.length > 0 || upcoming.length > 0) && section !== 'archive' && (
          <div className="mb-8 grid gap-3 sm:grid-cols-2 animate-fade-in">
            {overdue.length > 0 && (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 flex gap-3">
                <Icon name="AlertCircle" size={20} className="text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">Просрочено: {overdue.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{overdue[0].title}</p>
                </div>
              </div>
            )}
            {upcoming.length > 0 && (
              <div className="rounded-2xl border border-border bg-secondary/50 p-4 flex gap-3">
                <Icon name="Bell" size={20} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">Скоро срок: {upcoming.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{upcoming[0].title}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TASKS */}
        {section === 'tasks' && (
          <div className="space-y-2 animate-fade-in">
            {active.filter((t) => !t.done).length === 0 && (
              <p className="text-center text-muted-foreground py-12 font-hand text-2xl">Всё сделано! 🚀</p>
            )}
            {active.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due)).map((t) => (
              <TaskRow key={t.id} task={t} onToggle={toggle} onArchive={archive} />
            ))}
            {active.some((t) => t.done) && (
              <p className="pt-6 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Выполнено</p>
            )}
            {active.filter((t) => t.done).map((t) => (
              <TaskRow key={t.id} task={t} onToggle={toggle} onArchive={archive} />
            ))}
          </div>
        )}

        {section === 'calendar'  && <CalendarView tasks={active} />}
        {section === 'analytics' && <Analytics stats={stats} />}
        {section === 'archive' && (
          <div className="space-y-2 animate-fade-in">
            {tasks.filter((t) => t.archived).length === 0 && (
              <p className="text-center text-muted-foreground py-12 font-hand text-2xl">Архив пуст</p>
            )}
            {tasks.filter((t) => t.archived).map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
                <Icon name="CheckCircle2" size={20} className="text-muted-foreground" />
                <span className="flex-1 text-sm line-through text-muted-foreground">{t.title}</span>
                <button onClick={() => restore(t.id)} className="text-xs font-medium hover:underline flex items-center gap-1">
                  <Icon name="RotateCcw" size={14} /> Вернуть
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Mobile nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card/90 backdrop-blur border-t border-border flex justify-around py-2">
        {navItems.map((n) => (
          <button key={n.id} onClick={() => setSection(n.id)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-[11px] ${section === n.id ? 'text-foreground' : 'text-muted-foreground'}`}>
            <Icon name={n.icon} size={20} />
            {n.label}
          </button>
        ))}
      </nav>

      {/* In-app toast уведомление */}
      {toast && (
        <div className="fixed top-5 right-5 z-[60] flex items-start gap-3 bg-foreground text-background px-5 py-4 rounded-2xl shadow-2xl animate-fade-in max-w-sm">
          <Icon name="Bell" size={18} className="shrink-0 mt-0.5 text-amber-400" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold opacity-70 mb-0.5">Напоминание</p>
            <p className="text-sm font-medium line-clamp-2">{toast.title}</p>
          </div>
          <button onClick={() => setToast(null)} className="opacity-50 hover:opacity-100 transition shrink-0">
            <Icon name="X" size={16} />
          </button>
        </div>
      )}

      {/* MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-scale-in overflow-hidden">

            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <h2 className="text-lg font-bold">Новая задача</h2>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground transition">
                <Icon name="X" size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">

              {/* Title */}
              <input
                autoFocus
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Название задачи"
                className="w-full text-xl font-semibold border-0 border-b border-border pb-3 outline-none placeholder:text-muted-foreground/50 bg-transparent"
              />

              {/* Note */}
              <textarea
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Описание..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-secondary/50 text-sm outline-none resize-none placeholder:text-muted-foreground/60"
              />

              {/* Priority + Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Приоритет</p>
                  <div className="flex flex-col gap-1.5">
                    {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                      <button key={p} type="button" onClick={() => setForm((f) => ({ ...f, priority: p }))}
                        className={`px-4 py-2 rounded-xl border text-sm font-medium text-left transition ${
                          form.priority === p
                            ? `${priorityMeta[p].bg} ${priorityMeta[p].border} ${priorityMeta[p].text}`
                            : 'border-border text-foreground hover:bg-secondary/50'
                        }`}>
                        {priorityMeta[p].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Статус</p>
                  <div className="flex flex-col gap-1.5">
                    {(['todo', 'inprogress', 'done'] as Status[]).map((s) => (
                      <button key={s} type="button" onClick={() => setForm((f) => ({ ...f, status: s }))}
                        className={`px-4 py-2 rounded-xl border text-sm font-medium text-left transition ${
                          form.status === s
                            ? `${statusMeta[s].bg} ${statusMeta[s].border} ${statusMeta[s].text}`
                            : 'border-border text-foreground hover:bg-secondary/50'
                        }`}>
                        {statusMeta[s].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Срок (дата + время) */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">Срок</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={form.due}
                    onChange={(e) => setForm((f) => ({ ...f, due: e.target.value }))}
                    className="px-4 py-2.5 rounded-xl border border-border text-sm outline-none bg-white"
                  />
                  <input
                    type="time"
                    value={form.dueTime}
                    onChange={(e) => setForm((f) => ({ ...f, dueTime: e.target.value }))}
                    className="px-4 py-2.5 rounded-xl border border-border text-sm outline-none bg-white"
                  />
                </div>
              </div>

              {/* Уведомление */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium flex items-center gap-1.5">
                  <Icon name="Bell" size={13} />
                  Уведомление
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {REMINDER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, reminderOffset: opt.value }))}
                      disabled={opt.value !== 'none' && !form.due}
                      className={`px-3 py-2.5 rounded-xl border text-sm text-left transition ${
                        form.reminderOffset === opt.value
                          ? 'border-foreground bg-secondary text-foreground font-medium'
                          : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-40 disabled:cursor-not-allowed'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {form.reminderOffset !== 'none' && form.due && (
                  <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                    <Icon name="Clock" size={12} />
                    Уведомление: {fmtDateTime(calcReminderAt(form.due, form.dueTime, form.reminderOffset)!)}
                  </p>
                )}
                {form.reminderOffset !== 'none' && !form.due && (
                  <p className="mt-2 text-xs text-muted-foreground">Сначала укажите срок задачи</p>
                )}
              </div>

              {/* Tags */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">Теги</p>
                <div className="flex gap-2 mb-2">
                  <input
                    value={form.tagInput}
                    onChange={(e) => setForm((f) => ({ ...f, tagInput: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTagFromInput(); } }}
                    placeholder="Добавить тег..."
                    className="px-3 py-1.5 rounded-lg border border-border text-sm outline-none bg-white flex-1"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {PRESET_TAGS.map((tag) => (
                    <button key={tag} type="button" onClick={() => togglePresetTag(tag)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                        form.tags.includes(tag)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                      }`}>
                      {tag}
                    </button>
                  ))}
                  {form.tags.filter((t) => !PRESET_TAGS.includes(t)).map((tag) => (
                    <button key={tag} type="button"
                      onClick={() => setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }))}
                      className="px-3 py-1 rounded-full text-xs font-medium border bg-primary text-primary-foreground border-primary flex items-center gap-1">
                      {tag} <Icon name="X" size={10} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-border">
              <button onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary/50 transition">
                Отмена
              </button>
              <button onClick={createTask} disabled={!form.title.trim()}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40 transition">
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, onToggle, onArchive }: { task: Task; onToggle: (id: number) => void; onArchive: (id: number) => void }) {
  const isOverdue = !task.done && task.due < todayISO();
  return (
    <div className="group flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-foreground/20 transition">
      <button onClick={() => onToggle(task.id)}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
          task.done ? 'bg-primary border-primary' : 'border-muted-foreground/40 hover:border-foreground'
        }`}>
        {task.done && <Icon name="Check" size={12} className="text-primary-foreground" />}
      </button>
      <span className={`w-2 h-2 rounded-full shrink-0 ${priorityMeta[task.priority].dot}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${task.done ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {task.tags.map((tag) => (
            <span key={tag} className="text-[11px] text-muted-foreground">{tag}</span>
          ))}
          {task.reminderAt && !task.done && (
            <span className={`text-[11px] flex items-center gap-0.5 ${task.reminderFired ? 'text-muted-foreground/50' : 'text-amber-600'}`}>
              <Icon name="Bell" size={10} />
              {fmtDateTime(task.reminderAt)}
            </span>
          )}
        </div>
      </div>
      <span className={`text-xs shrink-0 ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
        {fmtDate(task.due)}
      </span>
      <button onClick={() => onArchive(task.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition" title="В архив">
        <Icon name="Archive" size={16} />
      </button>
    </div>
  );
}

function CalendarView({ tasks }: { tasks: Task[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const tasksOn = (day: number) => tasks.filter((t) => t.due === new Date(year, month, day).toISOString().slice(0, 10));
  return (
    <div className="animate-fade-in">
      <h2 className="text-lg font-semibold mb-4 capitalize">
        {now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
      </h2>
      <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-muted-foreground mb-2">
        {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((d) => <div key={d} className="py-1 font-medium">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dt = tasksOn(day);
          const isToday = day === now.getDate();
          return (
            <div key={i} className={`aspect-square rounded-xl border p-2 flex flex-col ${isToday ? 'border-foreground bg-secondary/50' : 'border-border'}`}>
              <span className={`text-xs ${isToday ? 'font-bold' : 'text-muted-foreground'}`}>{day}</span>
              <div className="mt-auto flex flex-wrap gap-0.5">
                {dt.slice(0, 3).map((t) => <span key={t.id} className={`w-1.5 h-1.5 rounded-full ${priorityMeta[t.priority].dot}`} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Analytics({ stats }: { stats: { total: number; done: number; pending: number; overdue: number; rate: number } }) {
  const cards = [
    { label: 'Всего задач', value: stats.total,  icon: 'ListChecks' },
    { label: 'Выполнено',   value: stats.done,    icon: 'CheckCircle2' },
    { label: 'В работе',    value: stats.pending, icon: 'Clock' },
    { label: 'Просрочено',  value: stats.overdue, icon: 'AlertCircle' },
  ];
  return (
    <div className="animate-fade-in space-y-6">
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border p-5">
            <Icon name={c.icon} size={20} className="text-muted-foreground mb-3" />
            <p className="text-3xl font-extrabold">{c.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{c.label}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border p-6">
        <div className="flex justify-between items-baseline mb-3">
          <p className="text-sm font-medium">Прогресс выполнения</p>
          <p className="text-2xl font-bold">{stats.rate}%</p>
        </div>
        <div className="h-3 rounded-full bg-secondary overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${stats.rate}%` }} />
        </div>
      </div>
    </div>
  );
}
