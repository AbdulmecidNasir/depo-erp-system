import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { CreditorRecord, LedgerStatus } from '../../types';

const statusOptions: LedgerStatus[] = ['В ожидании', 'Оплачено', 'Не оплачено'];

const CreditorsPage: React.FC = () => {
  const [items, setItems] = useState<CreditorRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Partial<CreditorRecord>>({ currency: 'UZS', status: 'В ожидании' });
  const [filters, setFilters] = useState<{ status?: string; search?: string }>({});

  const canSubmit = useMemo(() => Boolean(form.partyName && form.amount && (form.amount as number) >= 0), [form.partyName, form.amount]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.creditors.getAll({ limit: 100, status: filters.status, search: filters.search });
      if (res.success) {
        const data = (res as any).data as any[];
        const mapped = data.map((d: any) => ({
          id: d._id || d.id,
          partyName: d.partyName,
          contact: d.contact,
          amount: d.amount,
          currency: d.currency,
          dueDate: d.dueDate ? new Date(d.dueDate).toISOString() : undefined,
          status: d.status,
          notes: d.notes,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        })) as CreditorRecord[];
        setItems(mapped);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters.status, filters.search]);

  const handleCreate = async () => {
    if (!canSubmit) return;
    const payload = {
      partyName: form.partyName,
      contact: form.contact || '',
      amount: Number(form.amount),
      currency: form.currency || 'UZS',
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
      status: form.status || 'Beklemede',
      notes: form.notes || ''
    };
    const res = await api.creditors.create(payload);
    if ((res as any).success) {
      setForm({ currency: 'UZS', status: 'Beklemede' });
      await load();
    }
  };

  const handleUpdate = async (id: string, updates: Partial<CreditorRecord>) => {
    const res = await api.creditors.update(id, updates);
    if ((res as any).success) await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
    const res = await api.creditors.delete(id);
    if ((res as any).success) await load();
  };

  const handleStatusChange = async (id: string, status: LedgerStatus) => {
    const res = await api.creditors.updateStatus(id, status);
    if ((res as any).success) await load();
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Кредиторы (Кредиторская задолженность)</h2>
      {/* Create form */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input className="border rounded px-3 py-2" placeholder="Название" value={form.partyName || ''} onChange={(e) => setForm(f => ({ ...f, partyName: e.target.value }))} />
          <input className="border rounded px-3 py-2" placeholder="Контакты" value={form.contact || ''} onChange={(e) => setForm(f => ({ ...f, contact: e.target.value }))} />
          <input className="border rounded px-3 py-2" placeholder="Сумма" type="number" min={0} value={form.amount as any || ''} onChange={(e) => setForm(f => ({ ...f, amount: Number(e.target.value) }))} />
          <input className="border rounded px-3 py-2" placeholder="Валюта" value={form.currency || 'UZS'} onChange={(e) => setForm(f => ({ ...f, currency: e.target.value }))} />
          <input className="border rounded px-3 py-2" placeholder="Срок оплаты" type="date" value={form.dueDate ? (form.dueDate as string).slice(0, 10) : ''} onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))} />
          <select className="border rounded px-3 py-2" value={form.status || 'В ожидании'} onChange={(e) => setForm(f => ({ ...f, status: e.target.value as LedgerStatus }))}>
            {statusOptions.map(s => (<option key={s} value={s}>{s}</option>))}
          </select>
        </div>
        <div className="mt-3 flex gap-2">
          <input className="border rounded px-3 py-2 flex-1" placeholder="Заметки" value={form.notes || ''} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
          <button disabled={!canSubmit} onClick={handleCreate} className={`px-4 py-2 rounded text-white ${canSubmit ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}>Добавить</button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-3 mb-4 flex gap-3 items-center">
        <input className="border rounded px-3 py-2" placeholder="Поиск" value={filters.search || ''} onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))} />
        <select className="border rounded px-3 py-2" value={filters.status || ''} onChange={(e) => setFilters(f => ({ ...f, status: e.target.value || undefined }))}>
          <option value="">Все</option>
          {statusOptions.map(s => (<option key={s} value={s}>{s}</option>))}
        </select>
        {loading && <span className="text-sm text-gray-500">Загрузка...</span>}
      </div>

      {/* List */}
      <div className="bg-white rounded-lg shadow divide-y">
        <div className="grid grid-cols-12 font-semibold px-4 py-2 bg-gray-50">
          <div className="col-span-3">Название</div>
          <div className="col-span-2">Сумма</div>
          <div className="col-span-2">Срок</div>
          <div className="col-span-2">Статус</div>
          <div className="col-span-3 text-right">Действия</div>
        </div>
        {items.map(it => (
          <div key={it.id} className="grid grid-cols-12 px-4 py-2 items-center">
            <div className="col-span-3">
              <div className="font-medium">{it.partyName}</div>
              <div className="text-xs text-gray-500">{it.contact}</div>
            </div>
            <div className="col-span-2">{it.amount} {it.currency}</div>
            <div className="col-span-2">{it.dueDate ? it.dueDate.slice(0,10) : '-'}</div>
            <div className="col-span-2">
              <select className="border rounded px-2 py-1" value={it.status} onChange={(e) => handleStatusChange(it.id, e.target.value as LedgerStatus)}>
                {statusOptions.map(s => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
            <div className="col-span-3 flex justify-end gap-2">
              <button onClick={() => handleUpdate(it.id, { notes: prompt('Заметки', it.notes || '') || it.notes })} className="px-3 py-1 text-sm bg-yellow-500 text-white rounded">Изменить</button>
              <button onClick={() => handleDelete(it.id)} className="px-3 py-1 text-sm bg-red-600 text-white rounded">Удалить</button>
            </div>
          </div>
        ))}
        {items.length === 0 && !loading && (
          <div className="px-4 py-6 text-center text-gray-500">Нет записей</div>
        )}
      </div>
    </div>
  );
};

export default CreditorsPage;


