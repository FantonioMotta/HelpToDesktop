import { MiniCalendar } from "./components/MiniCalendar";
import { QuickNotes } from "./components/QuickNotes";
import { RemindersList } from "./components/RemindersList";
import { TodayTasks } from "./components/TodayTasks";
import { UpcomingEvents } from "./components/UpcomingEvents";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function DashboardView() {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">{getGreeting()}</h2>
        <p className="text-xs text-zinc-400">
          Visão geral do seu dia. Tudo é salvo automaticamente no seu computador.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <UpcomingEvents />
        <TodayTasks />
        <RemindersList />
        <QuickNotes />
      </div>

      <MiniCalendar />
    </div>
  );
}
