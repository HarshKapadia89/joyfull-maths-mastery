import { Link } from "@tanstack/react-router";
import { MessageCircle, ClipboardList, RotateCcw } from "lucide-react";

export function ModeCards() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Link
        to="/tutor"
        className="bg-gradient-learn shadow-card flex items-center gap-4 rounded-2xl p-5 text-white transition hover:brightness-110"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
          <MessageCircle className="h-6 w-6" />
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-[0.18em] uppercase opacity-90">
            Learning Mode
          </p>
          <p className="text-xl font-extrabold">Ask HBK Mathy</p>
        </div>
      </Link>
      <Link
        to="/revise"
        className="bg-gradient-hero shadow-card flex items-center gap-4 rounded-2xl p-5 text-white transition hover:brightness-110"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
          <RotateCcw className="h-6 w-6" />
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-[0.18em] uppercase opacity-90">
            Smart Revision
          </p>
          <p className="text-xl font-extrabold">Revise mistakes</p>
        </div>
      </Link>
      <Link
        to="/custom"
        className="bg-gradient-custom shadow-card flex items-center gap-4 rounded-2xl p-5 text-white transition hover:brightness-110"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
          <ClipboardList className="h-6 w-6" />
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-[0.18em] uppercase opacity-90">
            Build Your Own
          </p>
          <p className="text-xl font-extrabold">Custom Test</p>
        </div>
      </Link>
    </div>
  );
}
