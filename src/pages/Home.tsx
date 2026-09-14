import { GraduationCap, ChefHat, ArrowRight } from 'lucide-react';
import type { Page } from '../App';

export default function Home({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-4 py-12">
      <div className="text-center">
        <div className="mb-4 text-6xl">🍱</div>
        <h1 className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
          MEAL BUDDY
        </h1>
        <p className="mt-2 text-base text-slate-600 sm:text-lg">
          Your AI-powered college canteen assistant
        </p>
      </div>

      <h2 className="mt-10 text-center text-lg font-semibold text-slate-700">
        How can Meal Buddy help you today?
      </h2>

      <div className="mt-6 grid w-full max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2">
        <button
          onClick={() => onNavigate('student')}
          className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-brand-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
            <GraduationCap size={26} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">👨‍🎓 Student</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Tell us what you're craving and we'll find a meal that fits your preferences — budget,
              allergies, dietary needs and time.
            </p>
          </div>
          <span className="mt-2 inline-flex items-center gap-1 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-brand-600">
            Continue as Student <ArrowRight size={16} />
          </span>
        </button>

        <button
          onClick={() => onNavigate('cook')}
          className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-amber-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <ChefHat size={26} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">👨‍🍳 Canteen Cook</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Manage today's menu, prices, ingredients and availability. Students instantly see the
              latest menu in the AI assistant.
            </p>
          </div>
          <span className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-amber-600">
            Manage Canteen <ArrowRight size={16} />
          </span>
        </button>
      </div>

      <p className="mt-10 text-center text-xs text-slate-400">
        Meal Buddy uses a hybrid AI recommendation architecture: deterministic safety rules
        (allergies, availability, menu validity) + AI for natural-language ranking and explanations.
      </p>
    </div>
  );
}