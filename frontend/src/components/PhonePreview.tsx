import { AppIcon } from './Layout';

export function PhonePreview({
  appName,
  iconUrl,
  title,
  body,
  imageUrl,
}: {
  appName: string;
  iconUrl?: string;
  title: string;
  body: string;
  imageUrl?: string;
}) {
  const now = new Date();
  const time = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="mx-auto w-[280px]">
      <div className="rounded-[2.2rem] border-[6px] border-slate-900 bg-slate-900 p-2 shadow-2xl">
        <div className="relative h-[520px] overflow-hidden rounded-[1.7rem] bg-gradient-to-b from-indigo-500 via-violet-600 to-fuchsia-600">
          <div className="absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-slate-900" />
          <div className="pt-14 text-center text-white">
            <p className="text-5xl font-light">{time}</p>
            <p className="mt-1 text-xs opacity-80">
              {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="mt-8 px-3">
            <div className="rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur">
              <div className="flex items-start gap-2.5">
                <AppIcon name={appName} iconUrl={iconUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-500">{appName || 'Your app'}</p>
                    <p className="text-[10px] text-slate-400">now</p>
                  </div>
                  <p className="truncate text-[13px] font-semibold text-slate-900">{title || 'Notification title'}</p>
                  <p className="line-clamp-3 text-[12px] leading-snug text-slate-700">{body || 'Your notification body will appear here.'}</p>
                </div>
              </div>
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt=""
                  className="mt-2 h-28 w-full rounded-lg object-cover"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-slate-500">Lock-screen preview (approximate)</p>
    </div>
  );
}
