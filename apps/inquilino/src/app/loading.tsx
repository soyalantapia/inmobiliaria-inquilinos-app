import { Card } from '@llave/ui/card';
import { Skeleton } from '@llave/ui/skeleton';

export default function Loading() {
  return (
    <>
      <header className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </header>

      <main className="flex-1 space-y-6 px-5 pb-6">
        <Card className="space-y-2 p-5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-32" />
        </Card>

        <div className="space-y-3">
          <Skeleton className="h-3 w-20" />
          <Card className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-28" />
          </Card>
        </div>

        <div className="space-y-3">
          <Skeleton className="h-3 w-20" />
          {[1, 2, 3].map((i) => (
            <Card key={i} className="space-y-2 p-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-3 w-32" />
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}
