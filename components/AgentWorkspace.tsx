'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AgentDecision,
  ConversationMemory,
  createInitialMemory,
  generateAgentDecision
} from '@/lib/agent';
import { DELIVERY_CHARGE, calculateSellingPrice } from '@/lib/products';

type Sender = 'agent' | 'customer' | 'system';

type ChatMessage = {
  id: string;
  sender: Sender;
  text: string;
  createdAt: number;
  meta?: {
    urgency?: boolean;
    scarcity?: boolean;
    orderSummary?: AgentDecision['orderSummary'];
  };
};

const MAX_FOLLOW_UPS = 5;

const initialSystemMessage: ChatMessage = {
  id: 'system-0',
  sender: 'agent',
  text: 'হ্যালো! আমি আপনার ২৪/৭ AI সেলস পার্টনার। কাস্টমারের প্রশ্ন লিখে পাঠান, আমি CARE মেথডে উত্তর দেবো।',
  createdAt: Date.now()
};

const agentStatusEvent = (next: 'ON' | 'OFF') =>
  new CustomEvent('agent-command', { detail: { command: next === 'ON' ? 'AI ON' : 'AI OFF' as const } });

export default function AgentWorkspace() {
  const [agentStatus, setAgentStatus] = useState<'ON' | 'OFF'>('ON');
  const [messages, setMessages] = useState<ChatMessage[]>([initialSystemMessage]);
  const [input, setInput] = useState('');
  const [memory, setMemory] = useState<ConversationMemory>(createInitialMemory);
  const [isThinking, setIsThinking] = useState(false);
  const followUpTimer = useRef<NodeJS.Timeout | null>(null);
  const followUpAttempts = useRef(0);

  const activeProduct = useMemo(() => memory.activeProduct, [memory.activeProduct]);

  const toggleAgent = useCallback(
    (next: 'ON' | 'OFF') => {
      setAgentStatus(next);
      window.dispatchEvent(agentStatusEvent(next));
    },
    [setAgentStatus]
  );

  useEffect(() => {
    return () => {
      if (followUpTimer.current) {
        clearTimeout(followUpTimer.current);
      }
    };
  }, []);

  const pushMessage = useCallback((message: ChatMessage) => {
    setMessages((current) => [...current, message]);
  }, []);

  const scheduleFollowUp = useCallback(
    (payload: AgentDecision['followUp']) => {
      if (!payload) return;
      const schedule = (delay: number) => {
        if (followUpAttempts.current >= MAX_FOLLOW_UPS) return;
        if (followUpTimer.current) clearTimeout(followUpTimer.current);

        followUpTimer.current = setTimeout(() => {
          followUpAttempts.current += 1;
          pushMessage({
            id: `followup-${followUpAttempts.current}-${Date.now()}`,
            sender: 'agent',
            text: payload.message,
            createdAt: Date.now()
          });
          setMemory((prev) => ({
            ...prev,
            followUpScheduled: followUpAttempts.current < MAX_FOLLOW_UPS,
            followUpsSent: prev.followUpsSent + 1
          }));
          if (followUpAttempts.current < MAX_FOLLOW_UPS) {
            schedule(1000 * 45);
          }
        }, delay);
      };
      schedule(payload.delayMs);
    },
    [pushMessage]
  );

  const handleCommand = useCallback(
    (raw: string) => {
      const normalized = raw.trim().toUpperCase();
      if (normalized === 'AI ON') {
        toggleAgent('ON');
        pushMessage({
          id: `status-${Date.now()}`,
          sender: 'system',
          text: 'Agent_Status এখন ON। সব ইনকোয়ারিতে সাথে সাথেই রিপ্লাই করা হবে।',
          createdAt: Date.now()
        });
        return true;
      }
      if (normalized === 'AI OFF') {
        toggleAgent('OFF');
        pushMessage({
          id: `status-${Date.now()}`,
          sender: 'system',
          text: 'Agent_Status এখন OFF। আমি এখন সাইলেন্ট মোডে আছি।',
          createdAt: Date.now()
        });
        return true;
      }
      return false;
    },
    [toggleAgent, pushMessage]
  );

  const handleDecision = useCallback(
    (decision: AgentDecision) => {
      setMemory((prev) => ({
        ...prev,
        profile: { ...prev.profile, ...decision.profile },
        activeProduct: decision.activeProduct ?? prev.activeProduct,
        stage: decision.stage,
        followUpScheduled: decision.stage !== 'ready' && Boolean(decision.followUp),
        orderConfirmed: decision.stage === 'ready' || prev.orderConfirmed
      }));

      if (decision.stage === 'ready' || decision.stage === 'ordered') {
        if (followUpTimer.current) {
          clearTimeout(followUpTimer.current);
          followUpTimer.current = null;
        }
        followUpAttempts.current = MAX_FOLLOW_UPS;
      }

      pushMessage({
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: decision.reply,
        createdAt: Date.now(),
        meta: {
          urgency: decision.meta?.urgency,
          scarcity: decision.meta?.scarcity,
          orderSummary: decision.orderSummary
        }
      });

      if (decision.followUp) {
        scheduleFollowUp(decision.followUp);
      }
    },
    [pushMessage, scheduleFollowUp]
  );

  const submitMessage = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setInput('');
    const message: ChatMessage = {
      id: `customer-${Date.now()}`,
      sender: 'customer',
      text: trimmed,
      createdAt: Date.now()
    };

    pushMessage(message);

    if (handleCommand(trimmed)) {
      return;
    }

    if (agentStatus === 'OFF') {
      pushMessage({
        id: `silent-${Date.now()}`,
        sender: 'system',
        text: 'Agent_Status OFF থাকায় এই মেসেজে ইচ্ছাকৃতভাবে কোনো রিপ্লাই পাঠানো হয়নি।',
        createdAt: Date.now()
      });
      return;
    }

    setIsThinking(true);
    const delay = Math.random() * (3000 - 1000) + 1000;

    window.setTimeout(() => {
      const decision = generateAgentDecision(trimmed, memory);
      handleDecision(decision);
      setIsThinking(false);
    }, delay);
  }, [agentStatus, handleCommand, handleDecision, input, memory, pushMessage, setInput]);

  const profileSnapshot = memory.profile;

  return (
    <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 pb-24 pt-12 sm:px-8">
      <header className="flex flex-col gap-6 rounded-3xl bg-slate-900/80 p-6 shadow-soft backdrop-blur-lg sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-primary-200">Meta Inbox Copilot</p>
          <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
            বাংলা AI Sales Agent Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
            CARE মেথড, scarcity, urgency ও follow-up অটোমেশন সহ একটি মানবসদৃশ সেলস এজেন্ট।
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-300">Agent Status</span>
          <button
            onClick={() => toggleAgent(agentStatus === 'ON' ? 'OFF' : 'ON')}
            className={`relative flex h-12 w-28 items-center rounded-full px-2 transition-colors ${
              agentStatus === 'ON' ? 'bg-emerald-400/20' : 'bg-rose-400/20'
            }`}
          >
            <span
              className={`absolute h-9 w-9 rounded-full shadow-inner transition-all ${
                agentStatus === 'ON'
                  ? 'translate-x-16 bg-gradient-to-r from-emerald-400 to-emerald-500'
                  : 'translate-x-1 bg-gradient-to-r from-rose-400 to-rose-500'
              }`}
            />
            <span className="w-full text-center text-xs font-semibold tracking-wider text-white">
              {agentStatus}
            </span>
          </button>
        </div>
      </header>

      <section className="grid flex-1 gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="flex flex-col rounded-3xl bg-slate-900/70 p-6 shadow-soft backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Real-time Conversation</h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>CARE + Scarcity + Follow-up সক্রিয়</span>
              {isThinking && (
                <span className="flex items-center gap-2 text-primary-200">
                  <span className="h-2 w-2 animate-ping rounded-full bg-primary-500" />
                  Typing…
                </span>
              )}
            </div>
          </div>

          <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto rounded-2xl border border-slate-800/70 bg-slate-950/70 p-6">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`flex ${
                  message.sender === 'customer'
                    ? 'justify-start'
                    : message.sender === 'agent'
                    ? 'justify-end'
                    : 'justify-center'
                }`}
              >
                <div
                  className={`max-w-xl rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-lg ${
                    message.sender === 'customer'
                      ? 'rounded-bl-sm bg-slate-800 text-slate-100'
                      : message.sender === 'agent'
                      ? 'rounded-br-sm bg-gradient-to-r from-primary-500 to-primary-700 text-white'
                      : 'bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <p className="whitespace-pre-line">{message.text}</p>
                  {message.meta?.orderSummary && (
                    <div className="mt-3 rounded-xl bg-white/10 p-3 text-xs text-slate-100">
                      <p className="font-semibold">Order Summary</p>
                      <p>প্রোডাক্ট: {message.meta.orderSummary.product.name}</p>
                      <p>দাম: {message.meta.orderSummary.selling.toLocaleString('bn-BD')} টাকা</p>
                      <p>মোট: {message.meta.orderSummary.total.toLocaleString('bn-BD')} টাকা</p>
                    </div>
                  )}
                  {(message.meta?.scarcity || message.meta?.urgency) && (
                    <div className="mt-2 flex items-center gap-2 text-[11px] uppercase tracking-wide text-accent-400">
                      {message.meta.scarcity && <span>Scarcity Active</span>}
                      {message.meta.urgency && <span>Urgency Offer</span>}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            <AnimatePresence mode="wait">
              {isThinking && (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-end"
                >
                  <div className="rounded-2xl bg-primary-500/20 px-4 py-3 text-xs text-primary-100 shadow-inner">
                    টাইপ করা হচ্ছে…
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <form
            className="mt-6 flex gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitMessage();
            }}
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="কাস্টমারের মেসেজ লিখুন বা AI ON / AI OFF কমান্ড পাঠান…"
              rows={2}
              className="w-full resize-none rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-500 focus:shadow-glow"
            />
            <button
              type="submit"
              className="flex h-[52px] w-32 items-center justify-center rounded-2xl bg-gradient-to-r from-primary-500 to-primary-700 text-sm font-semibold uppercase tracking-wide text-white shadow-soft transition hover:shadow-glow"
            >
              Send
            </button>
          </form>
        </div>

        <aside className="flex flex-col gap-6">
          <div className="rounded-3xl bg-slate-900/70 p-6 shadow-soft backdrop-blur">
            <h3 className="text-lg font-semibold text-white">Customer Snapshot</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p>
                <span className="text-slate-400">নাম:</span>{' '}
                {profileSnapshot.name ?? 'এখনও শেয়ার করেননি'}
              </p>
              <p>
                <span className="text-slate-400">ফোন:</span>{' '}
                {profileSnapshot.phone ?? 'অপেক্ষায়'}
              </p>
              <p>
                <span className="text-slate-400">ঠিকানা:</span>{' '}
                {profileSnapshot.address ?? 'অপেক্ষায়'}
              </p>
              <p>
                <span className="text-slate-400">সাইজ/কালার:</span>{' '}
                {profileSnapshot.size || profileSnapshot.color || 'অপেক্ষায়'}
              </p>
            </div>
            {activeProduct && (
              <div className="mt-6 rounded-2xl border border-primary-500/30 bg-primary-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-primary-200">Focus Product</p>
                <h4 className="mt-2 text-lg font-semibold text-white">{activeProduct.name}</h4>
                <p className="mt-2 text-xs text-primary-100">{activeProduct.heroStat}</p>
                <div className="mt-4 space-y-2 text-sm text-slate-200">
                  {activeProduct.benefits.slice(0, 3).map((benefit) => (
                    <p key={benefit} className="flex gap-2 text-xs text-slate-200">
                      <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary-500" />
                      {benefit}
                    </p>
                  ))}
                </div>
                <p className="mt-4 text-xs text-primary-200">
                  বিক্রয় মূল্য: {calculateSellingPrice(activeProduct.basePrice).selling.toLocaleString('bn-BD')} টাকা | ডেলিভারি {DELIVERY_CHARGE.toLocaleString('bn-BD')} টাকা
                </p>
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-slate-900/70 p-6 shadow-soft backdrop-blur">
            <h3 className="text-lg font-semibold text-white">Playbook Checklist</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li>✅ Agent স্ট্যাটাস ON থাকলেই রেসপন্স করে</li>
              <li>✅ CARE ফ্রেমওয়ার্কে Context → Assurance → Relatability → Engagement</li>
              <li>✅ Scarcity ও Urgency অটো যুক্ত হয়</li>
              <li>✅ আপসেল/কম্বো সাজেশন রেডি</li>
              <li>✅ ২৪ ঘণ্টার মধ্যে ফলো-আপ রিমাইন্ডার</li>
              <li>✅ Soft closing: “রিজার্ভ করে রাখবো?”</li>
            </ul>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-primary-600/30 via-primary-500/20 to-transparent p-6 shadow-soft">
            <h3 className="text-lg font-semibold text-white">Active Campaigns</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-200">
              <p>🎁 Limited-time Offer: আজ রাত ১০টা পর্যন্ত ফ্রি ডেলিভারি</p>
              <p>🚚 Next-day Delivery ক্লাব ঢাকার ভিতর</p>
              <p>💬 কমেন্ট টু ইনবক্স অটোমেশন অন</p>
              <p>📞 Human handoff: escalation@brand.com</p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
