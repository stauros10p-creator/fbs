import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Zap } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { PageHeader } from '@/components/ui/PageHeader'
import { useSendCopilotMessage } from '@/hooks'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const SUGGESTED_QUESTIONS = [
  'Can we achieve SLA today?',
  'Where is the bottleneck right now?',
  'Where should I move employees?',
  'What happens if 2 packers take a break now?',
  'How many orders per hour do we need?',
  'Which role has the most surplus workers?',
  'Show me the current pressure ratios',
]

export function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: "Hello! I'm your Warehouse Copilot AI. I have full visibility into your current workforce allocation, live ops snapshot, SLA status, and pressure ratios. Ask me anything about your operations.",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [sessionId] = useState(() => uuidv4())
  const bottomRef = useRef<HTMLDivElement>(null)
  const sendMessage = useSendCopilotMessage()
  const engineResult = useAppStore(s => s.engineResult)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(text?: string) {
    const content = text ?? input.trim()
    if (!content || sendMessage.isPending) return
    setInput('')

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
      const response = await sendMessage.mutateAsync({ messages: history, sessionId })

      setMessages(prev => [...prev, {
        id: Date.now().toString() + 'a',
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      }])
    } catch (err) {
      toast.error('AI request failed — check your Anthropic API key')
      setMessages(prev => [...prev, {
        id: Date.now().toString() + 'e',
        role: 'assistant',
        content: '⚠️ Unable to reach AI service. Please check the API configuration.',
        timestamp: new Date(),
      }])
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        accent="AI Assistant"
        title="AI COPILOT"
        subtitle="Ask anything about workforce, SLA, bottlenecks, and breaks"
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={cn('flex gap-3 animate-slideIn', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-green/10 border border-green/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-green" />
                  </div>
                )}

                <div className={cn(
                  'max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-surface2 border border-border2 text-slate-200'
                    : 'bg-green/5 border border-green/15 text-slate-200',
                )}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  <div className={cn(
                    'text-[10px] mt-1.5 font-mono',
                    msg.role === 'user' ? 'text-muted text-right' : 'text-green/50',
                  )}>
                    {msg.timestamp.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-surface2 border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-muted" />
                  </div>
                )}
              </div>
            ))}

            {sendMessage.isPending && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-green/10 border border-green/25 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-green" />
                </div>
                <div className="bg-green/5 border border-green/15 rounded-xl px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 bg-green rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-4">
            <div className="flex gap-3">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask about staffing, SLA, bottlenecks, breaks…"
                rows={2}
                className="input flex-1 resize-none text-sm"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || sendMessage.isPending}
                className={cn(
                  'btn-primary flex items-center gap-2 self-end px-5',
                  (!input.trim() || sendMessage.isPending) && 'opacity-50 cursor-not-allowed',
                )}
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
            <p className="text-xs text-muted mt-2">Press Enter to send · Shift+Enter for new line</p>
          </div>
        </div>

        {/* Sidebar: context + suggestions */}
        <div className="w-72 border-l border-border flex flex-col overflow-y-auto">
          {/* Suggested questions */}
          <div className="p-4 border-b border-border">
            <div className="text-xs font-bold tracking-widest text-muted uppercase mb-3">
              Quick Questions
            </div>
            <div className="space-y-1.5">
              {SUGGESTED_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  disabled={sendMessage.isPending}
                  className="w-full text-left text-xs text-muted hover:text-slate-200 bg-surface2 hover:bg-surface3 border border-border hover:border-border2 rounded-lg px-3 py-2 transition-all leading-snug"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Live context */}
          <div className="p-4">
            <div className="text-xs font-bold tracking-widest text-muted uppercase mb-3 flex items-center gap-2">
              <Zap className="w-3 h-3" /> Live Context
            </div>
            {engineResult ? (
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted">Bottleneck</span>
                  <span className={engineResult.bottleneck_role ? 'text-orange' : 'text-green'}>
                    {engineResult.bottleneck_role ?? 'none'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Overall Risk</span>
                  <span className={engineResult.overall_risk > 0.6 ? 'text-red' : engineResult.overall_risk > 0.3 ? 'text-yellow' : 'text-green'}>
                    {Math.round(engineResult.overall_risk * 100)}%
                  </span>
                </div>
                {engineResult.role_capacity
                  .filter(r => r.pressure_ratio !== null)
                  .map(r => (
                    <div key={r.role} className="flex justify-between">
                      <span className="text-muted capitalize">{r.role} press.</span>
                      <span className={r.pressure_ratio! > 1.5 ? 'text-red' : r.pressure_ratio! > 1.0 ? 'text-orange' : r.pressure_ratio! > 0.5 ? 'text-yellow' : 'text-green'}>
                        {r.pressure_ratio?.toFixed(2)}×
                      </span>
                    </div>
                  ))}
                <div className="flex justify-between">
                  <span className="text-muted">Suggestions</span>
                  <span className="text-cyan">{engineResult.suggestions.length}</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted">Loading…</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
