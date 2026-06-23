'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Shield, Save, Clock, Key, Lock, Users, CalendarClock, FileText } from 'lucide-react';

interface Politica {
  timeout_inatividade: number;
  senha_min_caracteres: number;
  senha_exigir_numero: boolean;
  senha_exigir_especial: boolean;
  max_tentativas_login: number;
  tempo_bloqueio_min: number;
  sessao_unica: boolean;
  horario_inicio: string;
  horario_fim: string;
}

const DEFAULTS: Politica = {
  timeout_inatividade: 900,
  senha_min_caracteres: 6,
  senha_exigir_numero: false,
  senha_exigir_especial: false,
  max_tentativas_login: 5,
  tempo_bloqueio_min: 15,
  sessao_unica: false,
  horario_inicio: '',
  horario_fim: '',
};

const TIMEOUT_OPTIONS = [
  { value: 0, label: 'Desativado' },
  { value: 30, label: '30 segundos' },
  { value: 60, label: '1 minuto' },
  { value: 300, label: '5 minutos' },
  { value: 600, label: '10 minutos' },
  { value: 900, label: '15 minutos' },
  { value: 1800, label: '30 minutos' },
  { value: 3600, label: '1 hora' },
];

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${checked ? 'bg-blue-600' : 'bg-slate-300'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

export default function SegurancaSection() {
  const toast = useToast();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Politica>(DEFAULTS);
  const [empresaId, setEmpresaId] = useState('');
  const [logs, setLogs] = useState<{ tipo: string; usuario_nome: string; ip: string; created_at: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).single();
      if (!usr) return;
      const eid = (usr as { empresa_id: string }).empresa_id;
      setEmpresaId(eid);

      const { data: pol } = await supabase.from('politicas_seguranca').select('*').eq('empresa_id', eid).maybeSingle();
      if (pol) {
        setForm({
          timeout_inatividade: pol.timeout_inatividade ?? 900,
          senha_min_caracteres: pol.senha_min_caracteres ?? 6,
          senha_exigir_numero: pol.senha_exigir_numero ?? false,
          senha_exigir_especial: pol.senha_exigir_especial ?? false,
          max_tentativas_login: pol.max_tentativas_login ?? 5,
          tempo_bloqueio_min: pol.tempo_bloqueio_min ?? 15,
          sessao_unica: pol.sessao_unica ?? false,
          horario_inicio: pol.horario_inicio || '',
          horario_fim: pol.horario_fim || '',
        });
      }

      const { data: logData } = await supabase.from('log_acesso')
        .select('tipo, usuario_nome, ip, created_at')
        .order('created_at', { ascending: false }).limit(20);
      setLogs((logData || []) as typeof logs);

      setLoading(false);
    })();
  }, [supabase]);

  async function handleSave() {
    if (!empresaId) return;
    setSaving(true);
    const { error } = await supabase.from('politicas_seguranca').upsert({
      empresa_id: empresaId,
      ...form,
      horario_inicio: form.horario_inicio || null,
      horario_fim: form.horario_fim || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'empresa_id' });

    if (error) toast.error('Erro ao salvar: ' + error.message);
    else toast.success('Políticas de segurança salvas.');
    setSaving(false);
  }

  if (loading) return <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 text-slate-400">Carregando...</div>;

  const tipoLabel: Record<string, string> = { login: 'Login', logout: 'Logout', bloqueio: 'Bloqueio', tentativa_falha: 'Tentativa falha' };
  const tipoCor: Record<string, string> = { login: 'text-green-600', logout: 'text-slate-500', bloqueio: 'text-red-600', tentativa_falha: 'text-amber-600' };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Shield size={18} className="text-blue-500" />
          <h2 className="font-semibold text-slate-900">Políticas de Segurança</h2>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* Auto-logout */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-3">
              <Clock size={20} className="text-blue-500" />
              <div>
                <p className="text-sm font-medium text-slate-700">Auto-logout por inatividade</p>
                <p className="text-xs text-slate-400">Desloga automaticamente se o usuário ficar sem mexer</p>
              </div>
            </div>
            <select value={form.timeout_inatividade} onChange={(e) => setForm((p) => ({ ...p, timeout_inatividade: Number(e.target.value) }))}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
              {TIMEOUT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Força de senha */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
            <div className="flex items-center gap-3">
              <Key size={20} className="text-green-500" />
              <p className="text-sm font-medium text-slate-700">Força da senha</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pl-8">
              <label className="text-sm">
                <span className="text-xs text-slate-500">Mínimo de caracteres</span>
                <input type="number" min={4} max={32} value={form.senha_min_caracteres}
                  onChange={(e) => setForm((p) => ({ ...p, senha_min_caracteres: Math.max(4, Math.min(32, Number(e.target.value))) }))}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" />
              </label>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Exigir número</span>
                <Toggle checked={form.senha_exigir_numero} onChange={(v) => setForm((p) => ({ ...p, senha_exigir_numero: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Exigir caractere especial</span>
                <Toggle checked={form.senha_exigir_especial} onChange={(v) => setForm((p) => ({ ...p, senha_exigir_especial: v }))} />
              </div>
            </div>
          </div>

          {/* Bloqueio por tentativas */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
            <div className="flex items-center gap-3">
              <Lock size={20} className="text-red-500" />
              <div>
                <p className="text-sm font-medium text-slate-700">Bloqueio por tentativas</p>
                <p className="text-xs text-slate-400">Bloqueia a conta após várias tentativas de senha errada</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pl-8">
              <label className="text-sm">
                <span className="text-xs text-slate-500">Máximo de tentativas (0 = sem limite)</span>
                <input type="number" min={0} max={20} value={form.max_tentativas_login}
                  onChange={(e) => setForm((p) => ({ ...p, max_tentativas_login: Number(e.target.value) }))}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" />
              </label>
              <label className="text-sm">
                <span className="text-xs text-slate-500">Tempo de bloqueio (minutos)</span>
                <input type="number" min={1} max={120} value={form.tempo_bloqueio_min}
                  onChange={(e) => setForm((p) => ({ ...p, tempo_bloqueio_min: Number(e.target.value) }))}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" />
              </label>
            </div>
          </div>

          {/* Sessão única */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-3">
              <Users size={20} className="text-purple-500" />
              <div>
                <p className="text-sm font-medium text-slate-700">Sessão única</p>
                <p className="text-xs text-slate-400">Só permite 1 sessão ativa por usuário. Login em outro dispositivo desloga o anterior.</p>
              </div>
            </div>
            <Toggle checked={form.sessao_unica} onChange={(v) => setForm((p) => ({ ...p, sessao_unica: v }))} />
          </div>

          {/* Horário de acesso */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
            <div className="flex items-center gap-3">
              <CalendarClock size={20} className="text-amber-500" />
              <div>
                <p className="text-sm font-medium text-slate-700">Horário de acesso</p>
                <p className="text-xs text-slate-400">Restringe login fora do horário configurado. Deixe vazio para permitir 24h.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pl-8">
              <label className="text-sm">
                <span className="text-xs text-slate-500">Início</span>
                <input type="time" value={form.horario_inicio}
                  onChange={(e) => setForm((p) => ({ ...p, horario_inicio: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" />
              </label>
              <label className="text-sm">
                <span className="text-xs text-slate-500">Fim</span>
                <input type="time" value={form.horario_fim}
                  onChange={(e) => setForm((p) => ({ ...p, horario_fim: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg" />
              </label>
            </div>
          </div>

          <Button onClick={handleSave} loading={saving}>
            <Save size={15} /> Salvar políticas de segurança
          </Button>
        </div>
      </div>

      {/* Log de Acesso */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <FileText size={18} className="text-blue-500" />
          <h2 className="font-semibold text-slate-900">Log de Acesso (últimos 20)</h2>
        </div>
        {logs.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-400">Nenhum registro de acesso.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Tipo', 'Usuário', 'IP', 'Data/Hora'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((l, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className={`px-4 py-2.5 font-medium ${tipoCor[l.tipo] || 'text-slate-500'}`}>{tipoLabel[l.tipo] || l.tipo}</td>
                    <td className="px-4 py-2.5 text-slate-700">{l.usuario_nome || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{l.ip || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-400">{new Date(l.created_at).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
