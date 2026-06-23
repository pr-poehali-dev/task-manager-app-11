import { useState, useMemo } from 'react';
import Icon from '@/components/ui/icon';

type Priority = 'low' | 'medium' | 'high';
type Section = 'tasks' | 'calendar' | 'analytics' | 'archive';

interface Task {
  id: number;
  title: string;
  note?: string;
  due: string;
  priority: Priority;
  done: boolean;
  archived: boolean;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const initialTasks: Task[] = [
  { id: 1, title: 'Подготовить презентацию для клиента', note: 'Слайды + смета', due: addDays(-1), priority: 'high', done: false, archived: false },
  { id: 2, title: 'Созвон с командой дизайна', due: todayISO(), priority: 'medium', done: false, archived: false },
  { id: 3, title: 'Ответить на письма', due: todayISO(), priority: 'low', done: true, archived: false },
  { id: 4, title: 'Запланировать спринт', note: 'Распределить задачи', due: addDays(2), priority: 'high', done: false, archived: false },
  { id: 5, title: 'Обновить документацию', due: addDays(5), priority: 'low', done: false, archived: false },
  { id: 6, title: 'Релиз версии 2.0', due: addDays(-3), priority: 'high', done: true, archived: true },
];

const priorityMeta: Record<Priority, { label: string; dot: string }> = {
  high: { label: 'Высокий', dot: 'bg-destructive' },
  medium: { label: 'Средний', dot: 'bg-amber-500' },
  low: { label: 'Низкий', dot: 'bg-emerald-500' },
};

const navItems: { id: Section; label: string; icon: string }[] = [
  { id: 'tasks', label: 'Задачи', icon: 'ListChecks' },
  { id: 'calendar', label: 'Календарь', icon: 'Calendar' },
  { id: 'analytics', label: 'Аналитика', icon: 'BarChart3' },
  { id: 'archive', label: 'Архив', icon: 'Archive' },
];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

export default function Index() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [section, setSection] = useState<Section>('tasks');
  const [input, setInput] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [due, setDue] = useState(todayISO());

  const active = tasks.filter((t) => !t.archived);

  const overdue = active.filter((t) => !t.done && t.due < todayISO());
  const upcoming = active.filter((t) => !t.done && t.due >= todayISO() && t.due <= addDays(2));

  const toggle = (id: number) =>
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const archive = (id: number) =>
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, archived: true, done: true } : t)));
  const restore = (id: number) =>
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, archived: false } : t)));

  const addTask = () => {
    if (!input.trim()) return;
    setTasks((p) => [
      ...p,
      { id: Date.now(), title: input.trim(), due: due || todayISO(), priority, done: false, archived: false },
    ]);
    setInput('');
    setPriority('medium');
    setDue(todayISO());
  };

  const stats = useMemo(() => {
    const total = active.length;
    const done = active.filter((t) => t.done).length;
    return {
      total,
      done,
      pending: total - done,
      overdue: overdue.length,
      rate: total ? Math.round((done / total) * 100) : 0,
    };
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
            <button
              key={n.id}
              onClick={() => setSection(n.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                section === n.id
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}
            >
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

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10 md:py-14">
        {/* Header */}
        <header className="mb-8 animate-fade-in">
          <p className="font-hand text-2xl text-muted-foreground mb-1">
            {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight">
            {navItems.find((n) => n.id === section)?.label}
          </h1>
        </header>

        {/* Reminders */}
        {(overdue.length > 0 || upcoming.length > 0) && section !== 'archive' && (
          <div className="mb-8 grid gap-3 sm:grid-cols-2 animate-fade-in">
            {overdue.length > 0 && (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 flex gap-3">
                <Icon name="AlertCircle" size={20} className="text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Просрочено: {overdue.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{overdue[0].title}</p>
                </div>
              </div>
            )}
            {upcoming.length > 0 && (
              <div className="rounded-2xl border border-border bg-secondary/50 p-4 flex gap-3">
                <Icon name="Bell" size={20} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Скоро срок: {upcoming.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{upcoming[0].title}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TASKS */}
        {section === 'tasks' && (
          <div className="animate-fade-in">
            <form
              onSubmit={(e) => { e.preventDefault(); addTask(); }}
              className="flex flex-col gap-2 mb-8"
            >
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Введите название задачи…"
                  className="flex-1 px-4 py-3 rounded-xl border border-border bg-card text-sm outline-none focus:ring-2 focus:ring-ring/15 focus:border-foreground/30 transition"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2 whitespace-nowrap"
                >
                  <Icon name="Plus" size={16} />
                  Добавить
                </button>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground">Срок:</span>
                <input
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className="px-3 h-9 rounded-lg border border-border bg-card text-sm text-foreground outline-none focus:border-foreground/30 transition"
                />
                <span className="text-xs text-muted-foreground ml-2">Приоритет:</span>
                {(['low', 'medium', 'high'] as Priority[]).map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`flex items-center gap-1.5 px-3 h-9 rounded-lg border text-xs font-medium transition ${
                      priority === p ? 'border-foreground bg-secondary' : 'border-border text-muted-foreground hover:border-foreground/30'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${priorityMeta[p].dot}`} />
                    {priorityMeta[p].label}
                  </button>
                ))}
              </div>
            </form>

            <div className="space-y-2">
              {active.filter((t) => !t.done).length === 0 && (
                <p className="text-center text-muted-foreground py-12 font-hand text-2xl">Всё сделано! 🚀</p>
              )}
              {active
                .filter((t) => !t.done)
                .sort((a, b) => a.due.localeCompare(b.due))
                .map((t) => (
                  <TaskRow key={t.id} task={t} onToggle={toggle} onArchive={archive} />
                ))}

              {active.some((t) => t.done) && (
                <p className="pt-6 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Выполнено
                </p>
              )}
              {active
                .filter((t) => t.done)
                .map((t) => (
                  <TaskRow key={t.id} task={t} onToggle={toggle} onArchive={archive} />
                ))}
            </div>
          </div>
        )}

        {/* CALENDAR */}
        {section === 'calendar' && <CalendarView tasks={active} />}

        {/* ANALYTICS */}
        {section === 'analytics' && <Analytics stats={stats} />}

        {/* ARCHIVE */}
        {section === 'archive' && (
          <div className="space-y-2 animate-fade-in">
            {tasks.filter((t) => t.archived).length === 0 && (
              <p className="text-center text-muted-foreground py-12 font-hand text-2xl">Архив пуст</p>
            )}
            {tasks
              .filter((t) => t.archived)
              .map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card"
                >
                  <Icon name="CheckCircle2" size={20} className="text-muted-foreground" />
                  <span className="flex-1 text-sm line-through text-muted-foreground">{t.title}</span>
                  <button
                    onClick={() => restore(t.id)}
                    className="text-xs font-medium text-foreground hover:underline flex items-center gap-1"
                  >
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
          <button
            key={n.id}
            onClick={() => setSection(n.id)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-[11px] ${
              section === n.id ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            <Icon name={n.icon} size={20} />
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onArchive,
}: {
  task: Task;
  onToggle: (id: number) => void;
  onArchive: (id: number) => void;
}) {
  const isOverdue = !task.done && task.due < todayISO();
  return (
    <div className="group flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-foreground/20 transition animate-scale-in">
      <button
        onClick={() => onToggle(task.id)}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
          task.done ? 'bg-primary border-primary' : 'border-muted-foreground/40 hover:border-foreground'
        }`}
      >
        {task.done && <Icon name="Check" size={12} className="text-primary-foreground" />}
      </button>
      <span className={`w-2 h-2 rounded-full shrink-0 ${priorityMeta[task.priority].dot}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${task.done ? 'line-through text-muted-foreground' : ''}`}>
          {task.title}
        </p>
        {task.note && <p className="text-xs text-muted-foreground truncate">{task.note}</p>}
      </div>
      <span className={`text-xs shrink-0 ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
        {fmtDate(task.due)}
      </span>
      <button
        onClick={() => onArchive(task.id)}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition"
        title="В архив"
      >
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

  const tasksOn = (day: number) => {
    const iso = new Date(year, month, day).toISOString().slice(0, 10);
    return tasks.filter((t) => t.due === iso);
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-lg font-semibold mb-4 capitalize">
        {now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
      </h2>
      <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-muted-foreground mb-2">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
          <div key={d} className="py-1 font-medium">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dayTasks = tasksOn(day);
          const isToday = day === now.getDate();
          return (
            <div
              key={i}
              className={`aspect-square rounded-xl border p-2 flex flex-col ${
                isToday ? 'border-foreground bg-secondary/50' : 'border-border'
              }`}
            >
              <span className={`text-xs ${isToday ? 'font-bold' : 'text-muted-foreground'}`}>{day}</span>
              <div className="mt-auto flex flex-wrap gap-0.5">
                {dayTasks.slice(0, 3).map((t) => (
                  <span key={t.id} className={`w-1.5 h-1.5 rounded-full ${priorityMeta[t.priority].dot}`} />
                ))}
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
    { label: 'Всего задач', value: stats.total, icon: 'ListChecks' },
    { label: 'Выполнено', value: stats.done, icon: 'CheckCircle2' },
    { label: 'В работе', value: stats.pending, icon: 'Clock' },
    { label: 'Просрочено', value: stats.overdue, icon: 'AlertCircle' },
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
          <div
            className="h-full bg-primary rounded-full transition-all duration-700"
            style={{ width: `${stats.rate}%` }}
          />
        </div>
      </div>
    </div>
  );
}