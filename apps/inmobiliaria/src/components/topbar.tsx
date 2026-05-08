import { Bell, Search } from 'lucide-react';
import { Avatar, AvatarFallback } from '@llave/ui/avatar';
import { Input } from '@llave/ui/input';

export function Topbar({ titulo }: { titulo: string }) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <h1 className="text-xl font-semibold">{titulo}</h1>
      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="w-72 pl-9" placeholder="Buscar contrato, inquilino…" />
        </div>
        <button className="rounded-full p-2 hover:bg-muted" aria-label="Notificaciones">
          <Bell className="h-5 w-5" />
        </button>
        <Avatar>
          <AvatarFallback className="bg-primary/10 text-primary">RT</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
