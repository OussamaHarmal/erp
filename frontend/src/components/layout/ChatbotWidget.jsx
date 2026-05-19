import { useMemo, useRef, useState, useEffect } from 'react';
import { Send, X, Sparkles, Bot, UserRound, Loader2, ArrowUpRight, Minimize2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { chatbotAPI } from '../../services/api';

const quickAdmin = [
  'Résume le chiffre d’affaires',
  'Quelles factures ne sont pas exportées Sage ?',
  'Donne-moi les clients les plus rentables',
  'Comment vérifier mon export MAE ?'
];

const quickClient = [
  'Résume mes factures',
  'Quel est l’état de mes contrats ?',
  'Quels documents sont disponibles ?',
  'Explique-moi mon espace client'
];

export default function ChatbotWidget() {
  const { user, isDirecteur } = useAuth();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: isDirecteur
        ? 'Bonjour Admin 👋 Je peux analyser clients, contrats, factures, Sage et dashboard.'
        : 'Bonjour 👋 Je peux t’aider avec tes factures, contrats, documents et ton espace client.'
    }
  ]);
  const bodyRef = useRef(null);

  const quickPrompts = useMemo(() => isDirecteur ? quickAdmin : quickClient, [isDirecteur]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, loading, open]);

  useEffect(() => {
    const onGlobalKeyDown = (e) => {
      const isCmdK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
      if (isCmdK) {
        e.preventDefault();
        setOpen(true);
        setMinimized(false);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [open]);

  const sendMessage = async (text = input) => {
    const content = text.trim();
    if (!content || loading) return;
    const nextMessages = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    try {
      const history = nextMessages.filter(m => m.role === 'user' || m.role === 'assistant').slice(-8);
      const { data } = await chatbotAPI.ask(content, history);
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer || 'Je n’ai pas pu générer une réponse.' }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Erreur chatbot. Vérifie que le backend fonctionne et que la clé API IA est configurée si tu utilises une API externe." }]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {!open && (
        <button className="ai-fab" onClick={() => { setOpen(true); setMinimized(false); }} title="Assistant IA (Ctrl/⌘ + K)">
          <Sparkles size={20} />
          <span>Assistant IA</span>
          <ArrowUpRight size={18} style={{ opacity: 0.85 }} />
        </button>
      )}

      {open && (
        <div className={`ai-chat-panel ${minimized ? 'ai-chat-min' : ''}`}>
          <div className="ai-chat-header">
            <div className="ai-chat-title">
              <div className="ai-chat-logo"><Bot size={20} /></div>
              <div>
                <strong>UIS Assistant IA</strong>
                <span>{isDirecteur ? 'Mode Admin' : 'Mode Client'} · Ctrl/⌘+K pour ouvrir</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="ai-close" onClick={() => setMinimized((v) => !v)} title={minimized ? 'Agrandir' : 'Réduire'}>
                <Minimize2 size={18} />
              </button>
              <button className="ai-close" onClick={() => setOpen(false)} title="Fermer"><X size={18} /></button>
            </div>
          </div>

          {!minimized && (
            <>
              <div className="ai-chat-body" ref={bodyRef}>
            {messages.map((m, idx) => (
              <div key={idx} className={`ai-msg ${m.role === 'user' ? 'ai-msg-user' : 'ai-msg-bot'}`}>
                <div className="ai-msg-avatar">{m.role === 'user' ? <UserRound size={15} /> : <Bot size={15} />}</div>
                <div className="ai-msg-bubble">{m.content}</div>
              </div>
            ))}
            {loading && (
              <div className="ai-msg ai-msg-bot">
                <div className="ai-msg-avatar"><Bot size={15} /></div>
                <div className="ai-msg-bubble ai-loading"><Loader2 size={16} /> Analyse des données...</div>
              </div>
            )}
              </div>

              <div className="ai-quick-actions">
            {quickPrompts.map((q) => (
              <button key={q} onClick={() => sendMessage(q)} disabled={loading}>{q}</button>
            ))}
              </div>

              <div className="ai-input-zone">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={isDirecteur ? 'Demande une analyse ERP, Sage, CA...' : 'Pose une question sur tes factures ou contrats...'}
              rows={1}
            />
            <button onClick={() => sendMessage()} disabled={loading || !input.trim()}><Send size={18} /></button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
