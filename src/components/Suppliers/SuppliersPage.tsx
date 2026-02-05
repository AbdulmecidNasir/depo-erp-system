import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Label
} from 'recharts';
import { Download, AlertCircle, FileText, Truck, Package, X, ArrowUpRight, ArrowDownLeft, Wallet, Search, Calendar, User, Printer } from 'lucide-react';
import { exportToExcelWithOptions } from '../../utils/excelExport';

interface SupplierItem {
    id?: string;
    _id?: string;
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

const SuppliersPage: React.FC = () => {
    const { isDark } = useTheme();
    const navigate = useNavigate();
    const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState<{ name: string; contactPerson?: string; phone?: string; email?: string; address?: string; notes?: string }>({ name: '' });
    const [products, setProducts] = useState<any[]>([]);
    // const [productsLoading, setProductsLoading] = useState(false); // Unused
    const [incomingBySupplier, setIncomingBySupplier] = useState<Map<string, number>>(new Map());
    const [outgoingBySupplier, setOutgoingBySupplier] = useState<Map<string, number>>(new Map());
    const [lastOutDateBySupplier, setLastOutDateBySupplier] = useState<Map<string, string>>(new Map());
    const [soldUnitsBySupplier, setSoldUnitsBySupplier] = useState<Map<string, number>>(new Map());
    const [showDetails, setShowDetails] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsSupplier, setDetailsSupplier] = useState<{ id: string; name: string } | null>(null);
    const [detailsMovements, setDetailsMovements] = useState<any[]>([]);
    const [detailsTotals, setDetailsTotals] = useState<{ qty: number; amount: number }>({ qty: 0, amount: 0 });
    const [detailsActiveTab, setDetailsActiveTab] = useState<'overview' | 'supplies' | 'otgruzki' | 'returns' | 'payments' | 'products' | 'requests' | 'settlements'>('settlements');
    const [detailsRequests, setDetailsRequests] = useState<any[]>([]);
    const [detailsSupplies, setDetailsSupplies] = useState<any[]>([]);
    const [detailsOtgruzki, setDetailsOtgruzki] = useState<any[]>([]);
    const [detailsReturns, setDetailsReturns] = useState<any[]>([]);
    const [detailsPayments, setDetailsPayments] = useState<any[]>([]);
    const [detailsSettlements, setDetailsSettlements] = useState<any[]>([]);
    const [exportLoading, setExportLoading] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);
    const [paymentsBySupplier, setPaymentsBySupplier] = useState<Map<string, number>>(new Map());

    // Payment Tab Filters
    const [payFilterDate, setPayFilterDate] = useState('');
    const [payFilterProduct, setPayFilterProduct] = useState('');
    const [payFilterMethod, setPayFilterMethod] = useState('');

    useEffect(() => {
        const fetchAll = async () => {
            try {
                setLoading(true);
                // setProductsLoading(true);
                setError(null);
                const [supRes] = await Promise.all([
                    api.suppliers.getAll({ activeOnly: true, limit: 200 })
                ]);
                if ((supRes as any)?.success) {
                    const data = ((supRes as any).suppliers || (supRes as any).data || []) as any[];
                    setSuppliers(data);
                }
                // Fetch products in pages to respect backend limit (max 100)
                const LIMIT = 100;
                const MAX_PAGES = 20; // safety cap
                let page = 1;
                let all: any[] = [];
                // eslint-disable-next-line no-constant-condition
                while (true) {
                    const res: any = await api.products.getAll({ page, limit: LIMIT });
                    if (!res?.success) break;
                    const arr: any[] = res.data || [];
                    all = all.concat(arr);
                    const pg = res.pagination;
                    if (!pg) {
                        if (arr.length < LIMIT || page >= MAX_PAGES) break;
                    } else {
                        if (page >= (pg.pages || 1) || page >= MAX_PAGES) break;
                    }
                    page += 1;
                }
                setProducts(all);

                // Compute incoming debt per supplier (sum of purchasePrice * qty for 'in' movements)
                try {
                    const LIMIT_IN = 100;
                    const MAX_PAGES_IN = 20;
                    let pageIn = 1;
                    const sums = new Map<string, number>();
                    // eslint-disable-next-line no-constant-condition
                    while (true) {
                        const resIn: any = await api.stockMovements.getAll({ type: 'in', page: pageIn, limit: LIMIT_IN });
                        if (!resIn?.success) break;
                        const arrIn: any[] = resIn.data || [];
                        for (const m of arrIn) {
                            const prod = (m as any).productId || {};
                            const sid = String((m as any).supplierId || prod.supplierId || prod.supplier || '');
                            if (!sid) continue;
                            const price = Number(prod.purchasePrice || 0);
                            const qty = Number(m.quantity || 0);
                            const add = Math.max(0, price * qty);
                            if (add > 0) sums.set(sid, (sums.get(sid) || 0) + add);
                        }
                        const pgIn = resIn.pagination;
                        if (!pgIn) {
                            if (arrIn.length < LIMIT_IN || pageIn >= MAX_PAGES_IN) break;
                        } else {
                            if (pageIn >= (pgIn.pages || 1) || pageIn >= MAX_PAGES_IN) break;
                        }
                        pageIn += 1;
                    }
                    setIncomingBySupplier(sums);
                } catch (e) {
                    console.warn('Failed to compute supplier incoming totals', e);
                }

                // Compute outgoing (writeoff) totals per supplier to reduce debt, track last writeoff date and sold units
                try {
                    const LIMIT_OUT = 100;
                    const MAX_PAGES_OUT = 20;
                    let pageOut = 1;
                    const sumsOut = new Map<string, number>();
                    const lastOut = new Map<string, string>();
                    const soldUnits = new Map<string, number>();
                    // eslint-disable-next-line no-constant-condition
                    while (true) {
                        const resOut: any = await api.stockMovements.getAll({ type: 'out', page: pageOut, limit: LIMIT_OUT });
                        if (!resOut?.success) break;
                        const arrOut: any[] = resOut.data || [];
                        for (const m of arrOut) {
                            const prod = (m as any).productId || {};
                            const sid = String((m as any).supplierId || prod.supplierId || prod.supplier || '');
                            if (!sid) continue;
                            const price = Number(prod.purchasePrice || 0);
                            const qty = Number(m.quantity || 0);
                            const sub = Math.max(0, price * qty);
                            if (sub > 0) sumsOut.set(sid, (sumsOut.get(sid) || 0) + sub);
                            soldUnits.set(sid, (soldUnits.get(sid) || 0) + qty);
                            const d = m.createdAt ? new Date(m.createdAt).toISOString() : '';
                            if (d && (!lastOut.get(sid) || d > (lastOut.get(sid) as string))) lastOut.set(sid, d);
                        }
                        const pgOut = resOut.pagination;
                        if (!pgOut) {
                            if (arrOut.length < LIMIT_OUT || pageOut >= MAX_PAGES_OUT) break;
                        } else {
                            if (pageOut >= (pgOut.pages || 1) || pageOut >= MAX_PAGES_OUT) break;
                        }
                        pageOut += 1;
                    }
                    setOutgoingBySupplier(sumsOut);
                    setLastOutDateBySupplier(lastOut);
                    setSoldUnitsBySupplier(soldUnits);
                } catch (e) {
                    console.warn('Failed to compute supplier outgoing totals', e);
                }

                // Fetch all payments to compute settlement totals (Payments to supplier as 'Приход')
                try {
                    const LIMIT_PAY = 100;
                    let pagePay = 1;
                    const paySums = new Map<string, number>();
                    // eslint-disable-next-line no-constant-condition
                    while (true) {
                        const resPay: any = await api.payments.getAll({ page: pagePay, limit: LIMIT_PAY });
                        if (!resPay?.success) break;
                        const arrPay: any[] = resPay.data || [];
                        for (const p of arrPay) {
                            // Extract supplier ID from payment. Since it's populated, check the object or the ID field
                            const cust = p.customer;
                            const sid = cust ? (typeof cust === 'object' ? (cust.id || cust._id) : cust) : null;
                            if (!sid) continue;
                            const amount = Number(p.amount || 0);
                            paySums.set(String(sid), (paySums.get(String(sid)) || 0) + amount);
                        }
                        const pgPay = resPay.pagination;
                        if (!pgPay || pagePay >= (pgPay.pages || 1) || pagePay >= 20) break;
                        pagePay += 1;
                    }
                    setPaymentsBySupplier(paySums);
                } catch (e) {
                    console.warn('Failed to fetch payments for settlements', e);
                }
            } catch (e: any) {
                setError(e?.message || 'Ошибка загрузки поставщиков');
            } finally {
                setLoading(false);
                // setProductsLoading(false);
            }
        };
        fetchAll();
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return suppliers;
        return suppliers.filter((s) => {
            const parts = [s.name, s.contactPerson, s.email, s.phone, s.address]
                .filter(Boolean)
                .map((v) => String(v).toLowerCase());
            return parts.some((p) => p.includes(q));
        });
    }, [suppliers, search]);

    const formatDateTime = (iso?: string) =>
        iso ? new Date(iso).toLocaleString('ru-RU') : '—';

    const getZone = (s: SupplierItem) => {
        const addr = s.address || '';
        if (!addr) return '—';
        if (/uzbek/i.test(addr)) return 'Uzbekistan';
        return addr.split(',').pop()?.trim() || '—';
    };

    const openSupplierDetails = async (supplier: { id: string; name: string }) => {
        setShowDetails(true);
        setDetailsSupplier(supplier);
        setDetailsLoading(true);
        setDetailsMovements([]);
        setDetailsTotals({ qty: 0, amount: 0 });
        setDetailsSupplies([]);
        setDetailsOtgruzki([]);
        setDetailsReturns([]);
        setDetailsPayments([]);
        setDetailsSettlements([]);

        try {
            const LIMIT = 100;
            const MAX_PAGES = 20;
            let page = 1;
            const rows: any[] = [];

            // Fetch Incoming Movements (Supplies)
            while (true) {
                const res: any = await api.stockMovements.getAll({ type: 'in', page, limit: LIMIT } as any);
                if (!res?.success) break;
                const arr: any[] = res.data || [];
                for (const m of arr) {
                    const mProdRaw = (m as any).productId;
                    const mProdId = (typeof mProdRaw === 'object') ? (mProdRaw?._id || mProdRaw?.id) : mProdRaw;
                    const localProd = products.find(p => String(p.id || p._id) === String(mProdId));
                    const prod = localProd || (typeof mProdRaw === 'object' ? mProdRaw : {});

                    const targetId = String(supplier.id);
                    const mSupId = (m as any).supplierId || (m as any).supplier;
                    const pSupId = prod.supplierId || prod.supplier;
                    const mSupIdStr = typeof mSupId === 'object' ? (mSupId?._id || mSupId?.id) : mSupId;
                    const pSupIdStr = typeof pSupId === 'object' ? (pSupId?._id || pSupId?.id) : pSupId;

                    const isMatch = (mSupIdStr && String(mSupIdStr) === targetId) || (pSupIdStr && String(pSupIdStr) === targetId);
                    if (!isMatch) continue;

                    const price = Number(prod.purchasePrice || 0);
                    const qty = Number(m.quantity || 0);
                    const amount = Math.max(0, price * qty);
                    rows.push({
                        id: String(m.movementId || m._id || ''),
                        date: m.createdAt,
                        product: prod.nameRu || prod.name || '-',
                        brand: prod.brand || '',
                        model: prod.model || '',
                        qty,
                        price,
                        amount,
                        isReturn: (m.reason || '').toLowerCase().includes('return') || (m.reason || '').toLowerCase().includes('возврат')
                    });
                }
                const pg = res.pagination;
                if (!pg || page >= (pg.pages || 1) || page >= MAX_PAGES) break;
                page += 1;
            }

            const supplies = rows.filter(r => !r.isReturn);
            const returns = rows.filter(r => r.isReturn);
            setDetailsSupplies(supplies);
            setDetailsReturns(returns);
            setDetailsTotals({
                qty: supplies.reduce((acc, r) => acc + r.qty, 0),
                amount: supplies.reduce((acc, r) => acc + r.amount, 0)
            });

            // Fetch Outgoing
            let pOut = 1;
            const outRows: any[] = [];
            while (true) {
                const resOut: any = await api.stockMovements.getAll({ type: 'out', page: pOut, limit: LIMIT });
                if (!resOut?.success) break;
                const arrOut: any[] = resOut.data || [];
                for (const m of arrOut) {
                    const mProdRaw = (m as any).productId;
                    const mProdId = (typeof mProdRaw === 'object') ? (mProdRaw?._id || mProdRaw?.id) : mProdRaw;
                    const localProd = products.find(p => String(p.id || p._id) === String(mProdId));
                    const prod = localProd || (typeof mProdRaw === 'object' ? mProdRaw : {});
                    const pSupId = prod?.supplierId || prod?.supplier;
                    const pSupIdStr = typeof pSupId === 'object' ? (pSupId?._id || pSupId?.id) : pSupId;

                    if (String(pSupIdStr) === String(supplier.id)) {
                        outRows.push({
                            id: String(m.movementId || m._id || ''),
                            date: m.createdAt,
                            product: prod.nameRu || prod.name || '-',
                            brand: prod.brand || '',
                            model: prod.model || '',
                            qty: Number(m.quantity || 0),
                            price: Number(prod.salePrice || 0),
                            amount: Number(m.quantity || 0) * Number(prod.salePrice || 0)
                        });
                    }
                }
                const pg = resOut.pagination;
                if (!pg || pOut >= (pg.pages || 1) || pOut >= MAX_PAGES) break;
                pOut += 1;
            }
            setDetailsOtgruzki(outRows);

            // Fetch Payments
            let payData: any[] = [];
            try {
                const payRes = await api.payments.getAll({ customerId: supplier.id, limit: 200 });
                if (payRes.success) {
                    payData = payRes.data;
                    setDetailsPayments(payData);
                }
            } catch (e) {
                console.warn('Payment fetch fail', e);
            }

            // Settlement Ledger
            const settlementLines: any[] = [];
            payData.forEach((p: any) => {
                settlementLines.push({
                    type: 'Входящий платеж',
                    number: p.paymentNumber || '#PAY',
                    time: p.transactionDate || p.createdAt,
                    prihod: p.amount,
                    rashod: null,
                    comment: p.notes || '',
                    status: p.status === 'completed' ? 'ПРОД' : 'ОЖИД',
                    date: new Date(p.transactionDate || p.createdAt)
                });
            });
            supplies.forEach((s: any) => {
                settlementLines.push({
                    type: 'Отгрузка',
                    number: s.id ? s.id.slice(-5).toUpperCase() : '#SUP',
                    time: s.date,
                    prihod: null,
                    rashod: s.amount,
                    comment: s.product,
                    status: 'ПРОД',
                    date: new Date(s.date)
                });
            });
            settlementLines.sort((a, b) => b.date.getTime() - a.date.getTime());
            setDetailsSettlements(settlementLines);

        } catch (e) {
            console.error('Failed to load supplier details', e);
        } finally {
            setDetailsLoading(false);
        }
    };

    // Chart colors
    const CHART_COLORS = [
        '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
        '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
        '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6'
    ];

    // Build stock strictly by supplier; unknown bucket collects items without supplierId
    const stockBySupplier = useMemo(() => {
        // const idToName = new Map<string, string>(
        //     suppliers.map((s) => [String((s as any).id || (s as any)._id), s.name])
        // );
        const sums = new Map<string, number>();
        let unknown = 0;
        for (const p of products) {
            const units = Math.max(0, Number((p as any).stock || 0));
            const sid = (p as any).supplierId ? String((p as any).supplierId) : '';
            if (!sid) {
                unknown += units;
                continue;
            }
            sums.set(sid, (sums.get(sid) || 0) + units);
        }
        const rows = suppliers.map((s) => {
            const sid = String((s as any).id || (s as any)._id);
            return { id: sid, name: s.name, value: sums.get(sid) || 0 };
        });
        if (unknown > 0) rows.push({ id: 'unknown', name: 'Без поставщика', value: unknown });
        rows.sort((a, b) => b.value - a.value);
        return rows;
    }, [products, suppliers]);

    const totalUnits = useMemo(() => stockBySupplier.reduce((s, x) => s + x.value, 0), [stockBySupplier]);


    const recentSettlements = useMemo(() => {
        const items = suppliers
            .slice()
            .sort((a, b) => new Date(b.updatedAt || b.createdAt || '').getTime() - new Date(a.updatedAt || a.createdAt || '').getTime())
            .slice(0, 10)
            .map((s) => {
                const idStr = String((s as any).id || (s as any)._id || '');
                const docNo = idStr ? `#${idStr.slice(-4)}` : '—';

                // Real data calculations
                const initialBalance = (s as any).openingBalance || 0;
                const totalIn = paymentsBySupplier.get(idStr) || 0; // Payments to them
                const totalOut = incomingBySupplier.get(idStr) || 0; // Purchases from them
                const finalBalance = initialBalance + totalIn - totalOut;

                // "Наличный счет" amount - using the latest entry or total in for now
                const amount = totalIn;

                return {
                    id: idStr || s.name,
                    name: s.name,
                    date: s.updatedAt || s.createdAt,
                    doc: `Приход ${docNo}`,
                    balanceText: `Остаток долга: ${new Intl.NumberFormat('ru-RU').format(Math.round(finalBalance))} UZS`,
                    amount,
                    currency: 'UZS',
                };
            });
        return items;
    }, [suppliers, incomingBySupplier, paymentsBySupplier]);


    const handleExportToExcel = async () => {
        try {
            setExportLoading(true);
            setExportError(null);

            // Prepare data for export from filtered suppliers
            const dataToExport = filtered.map((s) => {
                const id = (s.id || (s as any)._id || '') as string;
                const debtIn = incomingBySupplier.get(String(id)) || 0;
                const debtOut = outgoingBySupplier.get(String(id)) || 0;
                const debt = Math.max(0, debtIn - debtOut);
                const soldUnits = soldUnitsBySupplier.get(String(id)) || 0;
                const stockUnits = (products.filter((p: any) => String(p.supplierId || p.supplier || '') === String(id)).reduce((sum, p: any) => sum + Number(p.stock || 0), 0)) || 0;
                const stockValue = (products.filter((p: any) => String(p.supplierId || p.supplier || '') === String(id)).reduce((sum, p: any) => sum + Number(p.stock || 0) * Number(p.salePrice || 0), 0)) || 0;

                // Top brand guess
                const brandCounts = new Map<string, number>();
                products.forEach((p: any) => {
                    const sid = String(p.supplierId || p.supplier || '');
                    if (sid !== String(id)) return;
                    const b = String(p.brand || '').trim();
                    if (!b) return;
                    brandCounts.set(b, (brandCounts.get(b) || 0) + 1);
                });
                const topBrand = Array.from(brandCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

                return {
                    name: s.name,
                    contactPerson: s.contactPerson || '—',
                    phone: s.phone || '—',
                    email: s.email || '—',
                    address: s.address || '—',
                    debt: Math.round(debt),
                    lastPaymentDate: formatDateTime(lastOutDateBySupplier.get(String(id)) || s.updatedAt || s.createdAt),
                    soldUnits: soldUnits,
                    stockUnits: stockUnits,
                    stockValue: Math.round(stockValue),
                    topBrand: topBrand,
                    zone: getZone(s),
                    notes: s.notes || '—'
                };
            });

            const columns = [
                { key: 'name', header: 'Название', width: 30, alignment: 'left' as const },
                { key: 'contactPerson', header: 'Контактное лицо', width: 25, alignment: 'left' as const },
                { key: 'phone', header: 'Телефон', width: 18, alignment: 'left' as const },
                { key: 'email', header: 'Email', width: 25, alignment: 'left' as const },
                { key: 'address', header: 'Адрес', width: 30, alignment: 'left' as const },
                { key: 'debt', header: 'Долг (сўм)', width: 18, alignment: 'right' as const, type: 'currency' as const },
                { key: 'lastPaymentDate', header: 'Последняя дата платежа', width: 22, alignment: 'center' as const },
                { key: 'soldUnits', header: 'Продано (шт.)', width: 15, alignment: 'center' as const, type: 'number' as const },
                { key: 'stockUnits', header: 'Остаток продуктов (шт.)', width: 20, alignment: 'center' as const, type: 'number' as const },
                { key: 'stockValue', header: 'Стоимость остатка (сўм)', width: 22, alignment: 'right' as const, type: 'currency' as const },
                { key: 'topBrand', header: 'Топ бренд', width: 20, alignment: 'left' as const },
                { key: 'zone', header: 'Зона', width: 18, alignment: 'left' as const },
                { key: 'notes', header: 'Примечания', width: 30, alignment: 'left' as const }
            ];

            const timestamp = new Date().toISOString().split('T')[0];
            await exportToExcelWithOptions(
                dataToExport,
                columns,
                `Поставщики_${timestamp}.xlsx`,
                'Поставщики'
            );

            console.log('✅ Suppliers exported to Excel successfully');
        } catch (error: any) {
            console.error('❌ Export failed:', error);
            setExportError(error.message || 'Ошибка экспорта. Пожалуйста, попробуйте снова.');
        } finally {
            setExportLoading(false);
        }
    };

    const currentSupplierBrand = useMemo(() => {
        if (!detailsSupplier) return '—';
        const brandCounts = new Map<string, number>();
        products.forEach((p: any) => {
            const sid = String(p.supplierId || p.supplier || '');
            if (sid !== String(detailsSupplier.id)) return;
            const b = String(p.brand || '').trim();
            if (!b) return;
            brandCounts.set(b, (brandCounts.get(b) || 0) + 1);
        });
        return Array.from(brandCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    }, [detailsSupplier, products]);

    const filteredPayments = useMemo(() => {
        return detailsPayments.filter(p => {
            const d = p.date || p.createdAt || '';
            const dMatch = !payFilterDate || d.includes(payFilterDate);
            const brand = currentSupplierBrand.toLowerCase();
            const pMatch = !payFilterProduct || brand.includes(payFilterProduct.toLowerCase()) || (p.notes || '').toLowerCase().includes(payFilterProduct.toLowerCase());
            const mMatch = !payFilterMethod || (p.method || '').toLowerCase().includes(payFilterMethod.toLowerCase());
            return dMatch && pMatch && mMatch;
        });
    }, [detailsPayments, payFilterDate, payFilterProduct, payFilterMethod, currentSupplierBrand]);

    return (
        <div className="p-6 space-y-4">
            {/* Live updates from stock movements */}
            {(() => {
                // Attach once
                // eslint-disable-next-line react-hooks/rules-of-hooks
                useEffect(() => {
                    const handler = (ev: any) => {
                        const d = ev?.detail || {};
                        if (!d || !d.supplierId) return;
                        const sid = String(d.supplierId);
                        if (d.type === 'in') {
                            setIncomingBySupplier((prev) => new Map(prev).set(sid, (prev.get(sid) || 0) + Number(d.amount || 0)));
                        } else if (d.type === 'out') {
                            setOutgoingBySupplier((prev) => new Map(prev).set(sid, (prev.get(sid) || 0) + Number(d.amount || 0)));
                            setLastOutDateBySupplier((prev) => new Map(prev).set(sid, d.date || new Date().toISOString()));
                            setSoldUnitsBySupplier((prev) => new Map(prev).set(sid, (prev.get(sid) || 0) + Number(d.qty || 0)));
                        }
                    };
                    window.addEventListener('stock-movement:created', handler as any);
                    return () => window.removeEventListener('stock-movement:created', handler as any);
                }, []);
                return null;
            })()}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Поставщики
                    </h1>
                    <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Управление базой поставщиков
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Поиск по названию, контакту, email..."
                        className={`px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                            }`}
                    />
                    <button
                        onClick={handleExportToExcel}
                        disabled={exportLoading}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        {exportLoading ? 'Экспорт...' : 'Экспорт'}
                    </button>
                    <button
                        onClick={() => setShowCreate(true)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isDark ? 'bg-emerald-700 hover:bg-emerald-600 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                    >
                        Добавить
                    </button>
                </div>
            </div>

            {/* Export Error Display */}
            {exportError && (
                <div className={`rounded-lg p-4 border transition-all duration-300 ${isDark
                    ? 'bg-red-900/20 border-red-800'
                    : 'bg-red-50 border-red-200'
                    }`}>
                    <div className="flex items-center">
                        <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                        <span className={`transition-colors duration-300 ${isDark ? 'text-red-400' : 'text-red-800'
                            }`}>{exportError}</span>
                    </div>
                </div>
            )}

            {/* Supplier details modal with tabs */}
            {showDetails && detailsSupplier && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className={`w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden ${isDark ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'}`}>

                        {/* Modal Header */}
                        <div className={`p-6 border-b flex items-start justify-between ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                            <div>
                                <h2 className="text-2xl font-bold">{detailsSupplier.name}</h2>
                                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                    <span className="flex items-center gap-1">
                                        <Truck size={14} />
                                        Поставщик
                                    </span>
                                    {/* Balance badge if needed */}
                                    {/* <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-bold">
                    Баланс: ...
                  </span> */}
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDetails(false)}
                                className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Tabs Header */}
                        <div className={`flex border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                            {[
                                { id: 'settlements', label: 'Взаиморасчеты', icon: FileText },
                                { id: 'overview', label: 'Обзор', icon: User },
                                { id: 'supplies', label: 'Поставки', icon: ArrowDownLeft },
                                { id: 'otgruzki', label: 'Отгрузки', icon: ArrowUpRight },
                                { id: 'payments', label: 'Платежи', icon: Wallet },
                                { id: 'products', label: 'Товары', icon: Package },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setDetailsActiveTab(tab.id as any)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium border-b-2 transition-colors ${detailsActiveTab === tab.id
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                        }`}
                                >
                                    <tab.icon size={16} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900/20">
                            {detailsLoading ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                                </div>
                            ) : (
                                <>
                                    {/* SETTLEMENTS TAB */}
                                    {detailsActiveTab === 'settlements' && (
                                        <div className="space-y-6">
                                            {/* Premium Header Cards */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
                                                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100'} shadow-sm`}>
                                                    <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Начальный остаток</span>
                                                    <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                        {new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 }).format(((suppliers.find(s => String(s.id || (s as any)._id) === String(detailsSupplier.id)) as any)?.openingBalance || 0))}
                                                    </span>
                                                </div>
                                                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-emerald-900/10 border-emerald-900/20' : 'bg-emerald-50 border-emerald-100'} shadow-sm`}>
                                                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider block mb-1">Приход (Оплаты)</span>
                                                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                                        {new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 }).format(detailsSettlements.reduce((sum, l) => sum + (l.prihod || 0), 0))}
                                                    </span>
                                                </div>
                                                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-blue-900/10 border-blue-900/20' : 'bg-blue-50 border-blue-100'} shadow-sm`}>
                                                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider block mb-1">Расход (Товар)</span>
                                                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                                        {new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 }).format(detailsSettlements.reduce((sum, l) => sum + (l.rashod || 0), 0))}
                                                    </span>
                                                </div>
                                                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-md`}>
                                                    <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider block mb-1 underline decoration-2 decoration-indigo-500 underline-offset-4">Конечный остаток</span>
                                                    <span className={`text-lg font-extrabold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                                                        {new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 }).format(((suppliers.find(s => String(s.id || (s as any)._id) === String(detailsSupplier.id)) as any)?.openingBalance || 0) + detailsSettlements.reduce((sum, l) => sum + (l.prihod || 0) - (l.rashod || 0), 0))}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <button className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] ${isDark ? 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-200' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'}`}>
                                                        <Printer size={18} className="text-indigo-500" />
                                                        Распечатать акт сверки
                                                    </button>
                                                </div>
                                                <div className="text-xs text-gray-500 font-medium bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full">
                                                    Записей: {detailsSettlements.length}
                                                </div>
                                            </div>

                                            <div className={`rounded-2xl border overflow-x-auto ${isDark ? 'border-gray-700 bg-gray-800/20' : 'border-gray-200 bg-white'}`}>
                                                <table className={`min-w-full divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                                    <thead className={isDark ? 'bg-gray-800/80' : 'bg-gray-50/80'}>
                                                        <tr>
                                                            <th className={`px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Документ</th>
                                                            <th className={`px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Номер</th>
                                                            <th className={`px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Дата и время</th>
                                                            <th className={`px-4 py-4 text-right text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Приход</th>
                                                            <th className={`px-4 py-4 text-right text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Расход</th>
                                                            <th className={`px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Комментарий</th>
                                                            <th className={`px-6 py-4 text-center text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Статус</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className={`divide-y ${isDark ? 'divide-gray-700/50' : 'divide-gray-200/50'}`}>
                                                        {detailsSettlements.map((l, idx) => (
                                                            <tr key={idx} className={`transition-colors ${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-blue-50/30'}`}>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`p-2 rounded-lg ${l.type.includes('платеж') ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                                                            {l.type.includes('платеж') ? <Wallet size={16} /> : <Package size={16} />}
                                                                        </div>
                                                                        <span className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{l.type}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-4 whitespace-nowrap text-sm">
                                                                    <span className="font-mono text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                                                                        {l.number}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-4 whitespace-nowrap text-[13px] text-gray-500 dark:text-gray-400">
                                                                    <div className="font-medium text-gray-700 dark:text-gray-300">{new Date(l.time).toLocaleDateString('ru-RU')}</div>
                                                                    <div className="text-[11px] opacity-70">{new Date(l.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                                                                </td>
                                                                <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-bold text-emerald-600">
                                                                    {l.prihod ? new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 }).format(l.prihod) : ''}
                                                                </td>
                                                                <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-bold text-blue-600">
                                                                    {l.rashod ? new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 }).format(l.rashod) : ''}
                                                                </td>
                                                                <td className="px-4 py-4 text-[13px] text-gray-500 max-w-[200px] truncate group relative">
                                                                    {l.comment}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                                    {l.status && (
                                                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-tighter uppercase shadow-sm border ${l.status === 'ПРОД'
                                                                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                                                            : 'bg-orange-500/10 text-orange-600 border-orange-500/20'
                                                                            }`}>
                                                                            {l.status === 'ПРОД' ? 'Проведено' : 'Ожидание'}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {detailsSettlements.length === 0 && (
                                                            <tr><td colSpan={7} className="p-12 text-center text-gray-400 font-medium">Нет записей по расчетам за этот период</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* OVERVIEW TAB */}
                                    {detailsActiveTab === 'overview' && (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                                    <h4 className="text-sm text-gray-500 mb-1">Всего поставок</h4>
                                                    <p className="text-2xl font-bold">{detailsSupplies.length}</p>
                                                </div>
                                                <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                                    <h4 className="text-sm text-gray-500 mb-1">Всего товаров (шт)</h4>
                                                    <p className="text-2xl font-bold">{detailsTotals.qty}</p>
                                                </div>
                                                <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                                    <h4 className="text-sm text-gray-500 mb-1">Сумма закупок</h4>
                                                    <p className="text-2xl font-bold text-emerald-600">
                                                        {new Intl.NumberFormat('ru-RU').format(Math.round(detailsTotals.amount))} UZS
                                                    </p>
                                                </div>
                                            </div>

                                            <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                                <h3 className="font-bold mb-4">Информация</h3>
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    {(() => {
                                                        const s = suppliers.find(sup => String(sup.id || (sup as any)._id) === String(detailsSupplier.id));
                                                        return (
                                                            <>
                                                                <div>
                                                                    <span className="text-gray-500 block">Телефон:</span>
                                                                    <span className="font-medium">{(s as any)?.phone || '—'}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-500 block">Email:</span>
                                                                    <span className="font-medium">{(s as any)?.email || '—'}</span>
                                                                </div>
                                                                <div className="col-span-2">
                                                                    <span className="text-gray-500 block">Адрес:</span>
                                                                    <span className="font-medium">{(s as any)?.address || '—'}</span>
                                                                </div>
                                                                <div className="col-span-2">
                                                                    <span className="text-gray-500 block">Заметки:</span>
                                                                    <p className="mt-1 p-2 rounded bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300">
                                                                        {(s as any)?.notes || 'Нет заметок'}
                                                                    </p>
                                                                </div>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* SUPPLIES TAB */}
                                    {detailsActiveTab === 'supplies' && (
                                        <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                            <table className={`min-w-full divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                                <thead className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                                                    <tr>
                                                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Дата</th>
                                                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Товар</th>
                                                        <th className={`px-4 py-3 text-right text-xs font-semibold uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Кол-во</th>
                                                        <th className={`px-4 py-3 text-right text-xs font-semibold uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Цена покупки</th>
                                                        <th className={`px-4 py-3 text-right text-xs font-semibold uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Сумма</th>
                                                    </tr>
                                                </thead>
                                                <tbody className={`divide-y ${isDark ? 'divide-gray-700 bg-gray-800' : 'divide-gray-200 bg-white'}`}>
                                                    {detailsSupplies.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Нет записей о поставках</td>
                                                        </tr>
                                                    ) : (
                                                        detailsSupplies.map((r, idx) => (
                                                            <tr key={idx} className={isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                                                                <td className="px-4 py-3 text-sm">{r.date ? new Date(r.date).toLocaleDateString('ru-RU') : '—'}</td>
                                                                <td className="px-4 py-3 text-sm">
                                                                    <div className={isDark ? 'text-white' : 'text-gray-900'}>{r.product}</div>
                                                                    <div className="text-xs text-gray-500">{[r.brand, r.model].filter(Boolean).join(' • ')}</div>
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-right font-medium">{r.qty}</td>
                                                                <td className="px-4 py-3 text-sm text-right text-gray-500">{new Intl.NumberFormat('ru-RU').format(Math.round(r.price))}</td>
                                                                <td className="px-4 py-3 text-sm text-right font-bold text-green-600">+{new Intl.NumberFormat('ru-RU').format(Math.round(r.amount))}</td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* OTGRUZKI (SALES) TAB */}
                                    {detailsActiveTab === 'otgruzki' && (
                                        <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                            <table className={`min-w-full divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                                <thead className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                                                    <tr>
                                                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Дата</th>
                                                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Товар</th>
                                                        <th className={`px-4 py-3 text-right text-xs font-semibold uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Кол-во</th>
                                                        <th className={`px-4 py-3 text-right text-xs font-semibold uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Цена продажи</th>
                                                        <th className={`px-4 py-3 text-right text-xs font-semibold uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Сумма</th>
                                                    </tr>
                                                </thead>
                                                <tbody className={`divide-y ${isDark ? 'divide-gray-700 bg-gray-800' : 'divide-gray-200 bg-white'}`}>
                                                    {detailsOtgruzki.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Нет записей об отгрузках</td>
                                                        </tr>
                                                    ) : (
                                                        detailsOtgruzki.map((r, idx) => (
                                                            <tr key={idx} className={isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                                                                <td className="px-4 py-3 text-sm">{r.date ? new Date(r.date).toLocaleDateString('ru-RU') : '—'}</td>
                                                                <td className="px-4 py-3 text-sm">
                                                                    <div className={isDark ? 'text-white' : 'text-gray-900'}>{r.product}</div>
                                                                    <div className="text-xs text-gray-500">{[r.brand, r.model].filter(Boolean).join(' • ')}</div>
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-right font-medium">{r.qty}</td>
                                                                <td className="px-4 py-3 text-sm text-right text-gray-500">{new Intl.NumberFormat('ru-RU').format(Math.round(r.price))}</td>
                                                                <td className="px-4 py-3 text-sm text-right font-bold text-blue-600">{new Intl.NumberFormat('ru-RU').format(Math.round(r.amount))}</td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* RETURNS TAB */}
                                    {detailsActiveTab === 'returns' && (
                                        <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                            <table className={`min-w-full divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                                <thead className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                                                    <tr>
                                                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Дата</th>
                                                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Товар</th>
                                                        <th className={`px-4 py-3 text-right text-xs font-semibold uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Кол-во</th>
                                                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Причина</th>
                                                    </tr>
                                                </thead>
                                                <tbody className={`divide-y ${isDark ? 'divide-gray-700 bg-gray-800' : 'divide-gray-200 bg-white'}`}>
                                                    {detailsReturns.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={4} className="px-6 py-8 text-center text-gray-500">Нет записей о возвратах</td>
                                                        </tr>
                                                    ) : (
                                                        detailsReturns.map((r, idx) => (
                                                            <tr key={idx} className={isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                                                                <td className="px-4 py-3 text-sm">{r.date ? new Date(r.date).toLocaleDateString('ru-RU') : '—'}</td>
                                                                <td className="px-4 py-3 text-sm">
                                                                    <div className={isDark ? 'text-white' : 'text-gray-900'}>{r.product}</div>
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-right font-medium text-red-600">{r.qty}</td>
                                                                <td className="px-4 py-3 text-sm text-gray-500">{r.reason || '—'}</td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* PAYMENTS TAB */}
                                    {detailsActiveTab === 'payments' && (
                                        <div className="space-y-4">
                                            <div className="flex flex-wrap gap-3 p-3 rounded-lg border bg-white dark:bg-gray-800 dark:border-gray-700">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={16} className="text-gray-500" />
                                                    <input
                                                        type="date"
                                                        value={payFilterDate}
                                                        onChange={e => setPayFilterDate(e.target.value)}
                                                        className="bg-transparent text-sm outline-none"
                                                    />
                                                </div>
                                                <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-2" />
                                                <div className="flex items-center gap-2 flex-1">
                                                    <Search size={16} className="text-gray-500" />
                                                    <input
                                                        placeholder="Фильтр по проекту/бренду..."
                                                        value={payFilterProduct}
                                                        onChange={e => setPayFilterProduct(e.target.value)}
                                                        className="bg-transparent text-sm w-full outline-none"
                                                    />
                                                </div>
                                                <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-2" />
                                                <div className="flex items-center gap-2 flex-1">
                                                    <User size={16} className="text-gray-500" />
                                                    <input
                                                        placeholder="Фильтр по методу/продавцу..."
                                                        value={payFilterMethod}
                                                        onChange={e => setPayFilterMethod(e.target.value)}
                                                        className="bg-transparent text-sm w-full outline-none"
                                                    />
                                                </div>
                                            </div>

                                            <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                                <table className={`min-w-full divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                                    <thead className={isDark ? 'bg-gray-900' : 'bg-gray-50'}>
                                                        <tr>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Клиент (Поставщик)</th>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Проект (Бренд)</th>
                                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Сумма</th>
                                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Дата когда дал</th>
                                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Дата когда должен</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                                        {filteredPayments.map((p, idx) => {
                                                            const cust = p.customer;
                                                            const custName = cust ? (typeof cust === 'object' ? (cust.name || cust.partyName || `${cust.firstName || ''} ${cust.lastName || ''}`.trim()) : '—') : '—';
                                                            return (
                                                                <tr key={idx} className={isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                                                                    <td className="px-4 py-3 text-sm font-medium">
                                                                        {custName || detailsSupplier?.name}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-sm">
                                                                        {p.category || currentSupplierBrand}
                                                                    </td>
                                                                    <td className={`px-4 py-3 text-sm text-right font-bold ${p.type === 'out' ? 'text-red-600' : 'text-emerald-600'}`}>
                                                                        {p.type === 'out' ? '-' : '+'}{new Intl.NumberFormat('ru-RU').format(Math.round(p.amount || 0))} {p.currency || 'UZS'}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-sm text-right">
                                                                        {p.transactionDate ? new Date(p.transactionDate).toLocaleDateString('ru-RU') : (p.createdAt ? new Date(p.createdAt).toLocaleDateString('ru-RU') : '—')}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-sm text-right text-gray-500">
                                                                        —
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                        {filteredPayments.length === 0 && (
                                                            <tr><td colSpan={5} className="p-8 text-center text-gray-500">Нет платежей</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* PRODUCTS TAB */}
                                    {detailsActiveTab === 'products' && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="font-bold text-lg">Товары поставщика</h3>
                                                <span className="text-sm text-gray-500">
                                                    Всего товаров: {
                                                        products.filter((p: any) => String(p.supplierId || p.supplier || '') === detailsSupplier.id).length
                                                    }
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {products
                                                    .filter((p: any) => {
                                                        // Robust matching for products list
                                                        const pSup = p.supplierId || p.supplier;
                                                        const pSupId = typeof pSup === 'object' ? (pSup?._id || pSup?.id) : pSup;
                                                        const pSupName = (typeof pSup === 'object' ? pSup?.name : '') || p.supplierName || '';

                                                        return (
                                                            (String(pSupId || '') === String(detailsSupplier.id)) ||
                                                            (pSupName && pSupName === detailsSupplier.name)
                                                        );
                                                    })
                                                    .map((p, i) => (
                                                        <div key={i} className={`p-4 rounded-xl border flex gap-3 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                                            {p.image ? (
                                                                <img src={p.image} alt="" className="w-12 h-12 object-cover rounded-lg bg-gray-100" />
                                                            ) : (
                                                                <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                                                                    <Package size={20} />
                                                                </div>
                                                            )}
                                                            <div className="min-w-0">
                                                                <div className="font-medium text-sm truncate">{p.nameRu || p.name}</div>
                                                                <div className="text-xs text-gray-500">{p.brand} {p.model}</div>
                                                                <div className="mt-1 flex items-center gap-2 text-xs">
                                                                    <span className={`px-1.5 py-0.5 rounded ${p.stock > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                                        {p.stock} шт
                                                                    </span>
                                                                    <span className="text-gray-400">•</span>
                                                                    <span>{new Intl.NumberFormat('ru-RU').format(p.purchasePrice || 0)} UZS</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                {products.filter((p: any) => {
                                                    const pSup = p.supplierId || p.supplier;
                                                    const pSupId = typeof pSup === 'object' ? (pSup?._id || pSup?.id) : pSup;
                                                    const pSupName = (typeof pSup === 'object' ? pSup?.name : '') || p.supplierName || '';
                                                    return (String(pSupId || '') === String(detailsSupplier.id)) || (pSupName && pSupName === detailsSupplier.name);
                                                }).length === 0 && (
                                                        <div className="col-span-full py-12 text-center text-gray-500 border border-dashed rounded-xl">
                                                            Нет привязанных товаров
                                                        </div>
                                                    )}
                                            </div>
                                        </div>
                                    )}

                                    {/* REQUESTS TAB */}
                                    {detailsActiveTab === 'requests' && (
                                        <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                            <table className={`min-w-full divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                                <thead className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                                                    <tr>
                                                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Номер</th>
                                                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Дата</th>
                                                        <th className={`px-4 py-3 text-left text-xs font-semibold uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Статус</th>
                                                        <th className={`px-4 py-3 text-right text-xs font-semibold uppercase ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Сумма</th>
                                                    </tr>
                                                </thead>
                                                <tbody className={`divide-y ${isDark ? 'divide-gray-700 bg-gray-800' : 'divide-gray-200 bg-white'}`}>
                                                    {detailsRequests.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={4} className="px-6 py-8 text-center text-gray-500">Нет заявок</td>
                                                        </tr>
                                                    ) : (
                                                        detailsRequests.map((r) => (
                                                            <tr key={r.id || r._id} className={isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                                                                <td className="px-4 py-3 text-sm font-medium">{r.orderNumber}</td>
                                                                <td className="px-4 py-3 text-sm">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('ru-RU') : '—'}</td>
                                                                <td className="px-4 py-3 text-sm">
                                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${r.status === 'delivered' ? 'bg-green-100 text-green-800' :
                                                                        r.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                                            'bg-yellow-100 text-yellow-800'
                                                                        }`}>
                                                                        {r.status === 'pending' ? 'Ожидание' :
                                                                            r.status === 'confirmed' ? 'Подтвержден' :
                                                                                r.status === 'processing' ? 'В обработке' :
                                                                                    r.status === 'shipped' ? 'Отгружен' :
                                                                                        r.status === 'delivered' ? 'Доставлен' :
                                                                                            r.status === 'completed' ? 'Завершен' :
                                                                                                r.status === 'returned' ? 'Возврат' :
                                                                                                    r.status === 'partially_returned' ? 'Частичный возврат' :
                                                                                                        r.status === 'cancelled' ? 'Отменен' : r.status}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-right font-bold">
                                                                    {new Intl.NumberFormat('ru-RU').format(r.total || 0)} UZS
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}



                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {error && (
                <div className={`p-3 rounded-lg border ${isDark ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>{error}</div>
            )}

            {/* Donut chart: Остаток по поставщикам */}
            <div className={`rounded-lg shadow-md ${isDark ? 'bg-gray-900' : 'bg-white'} p-4`}>
                <h3 className={`text-base font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-800'}`}>Остаток по поставщикам</h3>
                <div className="flex items-start gap-6">
                    <div className="w-full md:w-1/2 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={stockBySupplier} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={1} stroke={isDark ? '#111827' : '#ffffff'} strokeWidth={2}>
                                    {stockBySupplier.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                    <Label value={`${totalUnits} ед.`} position="center" />
                                </Pie>
                                <Tooltip formatter={(v: any) => [`${v} ед.`, 'Остаток']} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex-1 max-h-64 overflow-auto pr-2">
                        <h4 className={`text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>Последние расчеты по поставщикам</h4>
                        <ul className="space-y-3">
                            {recentSettlements.map((r) => (
                                <li key={r.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-semibold ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                                            {r.name?.[0]?.toUpperCase() || '—'}
                                        </div>
                                        <div className="min-w-0">
                                            <div className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{r.name}</div>
                                            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{r.date ? new Date(r.date).toLocaleString('ru-RU') : '—'}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-end gap-6">
                                        <div className="text-right">
                                            <div className={`text-sm font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{r.doc}</div>
                                            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{r.balanceText}</div>
                                        </div>
                                        <div className={`text-right font-semibold ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                                            {r.amount > 0 ? new Intl.NumberFormat('ru-RU').format(Math.round(r.amount)) : '—'} {r.amount > 0 ? r.currency : ''}
                                            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Наличный счет</div>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            <div className={`rounded-lg shadow-md overflow-hidden ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
                <div className="overflow-x-auto">
                    <table className={`min-w-full table-fixed divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                        <thead className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                            <tr>
                                <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Контрагент</th>
                                <th className={`px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Начальный остаток</th>
                                <th className={`px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Приход</th>
                                <th className={`px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Расход</th>
                                <th className={`px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Конечный остаток</th>
                                <th className={`px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Действия</th>
                            </tr>
                        </thead>
                        <tbody className={isDark ? 'divide-y divide-gray-800' : 'divide-y divide-gray-200'}>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className={`px-6 py-6 text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Загрузка...</td>
                                </tr>
                            ) : (
                                filtered.map((s) => {
                                    const id = (s.id || (s as any)._id || '') as string;
                                    const debtIn = incomingBySupplier.get(String(id)) || 0;
                                    const initialBalance = (s as any).openingBalance || 0;
                                    const prihod = paymentsBySupplier.get(String(id)) || 0; // Payments to them
                                    const rashod = debtIn; // Purchases from them
                                    const finalBalance = initialBalance + prihod - rashod;

                                    return (
                                        <tr key={id} className={isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{s.name}</div>
                                                {s.contactPerson && (
                                                    <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{s.contactPerson}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                <span className={`text-sm font-medium ${initialBalance < 0 ? 'text-red-500' : initialBalance > 0 ? 'text-emerald-500' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 }).format(initialBalance)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                <span className={`text-sm font-bold text-emerald-600`}>
                                                    {new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 }).format(prihod)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                <span className={`text-sm font-bold text-blue-600`}>
                                                    {new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 }).format(rashod)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                <span className={`text-sm font-bold ${finalBalance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                    {new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 }).format(finalBalance)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                <div className="flex items-center gap-2 justify-end">
                                                    <button
                                                        onClick={() => openSupplierDetails({ id: String(id), name: s.name })}
                                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
                                                    >Детали</button>
                                                    <button
                                                        onClick={() => navigate('/incoming-process', { state: { supplierId: String(id), supplierName: s.name } })}
                                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${isDark ? 'bg-emerald-700 hover:bg-emerald-600 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                                                    >Приход</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                        {filtered.length > 0 && !loading && (
                            <tfoot className={`${isDark ? 'bg-gray-800' : 'bg-gray-50'} border-t-2 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                <tr>
                                    <td className="px-4 py-3 text-sm font-bold">ИТОГО</td>
                                    <td className="px-4 py-3 text-sm text-right font-bold">
                                        {new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 }).format(
                                            filtered.reduce((sum, s) => sum + ((s as any).openingBalance || 0), 0)
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right font-bold text-emerald-600">
                                        {new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 }).format(
                                            filtered.reduce((sum, s) => sum + (paymentsBySupplier.get(String(s.id || (s as any)._id)) || 0), 0)
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right font-bold text-blue-600">
                                        {new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 }).format(
                                            filtered.reduce((sum, s) => sum + (incomingBySupplier.get(String(s.id || (s as any)._id)) || 0), 0)
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right font-bold">
                                        {new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 }).format(
                                            filtered.reduce((sum, s) => {
                                                const id = String(s.id || (s as any)._id);
                                                return sum + (((s as any).openingBalance || 0) + (paymentsBySupplier.get(id) || 0) - (incomingBySupplier.get(id) || 0));
                                            }, 0)
                                        )}
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Create supplier modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className={`w-full max-w-lg rounded-xl shadow-xl p-6 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Добавить поставщика</h3>
                            <button
                                onClick={() => { setShowCreate(false); setForm({ name: '' }); setError(null); }}
                                className={`${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                ✕
                            </button>
                        </div>
                        {error && (
                            <div className={`mb-3 p-2 rounded border ${isDark ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>{error}</div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="md:col-span-2">
                                <label className={`block text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Название</label>
                                <input
                                    value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                    className={`w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                    placeholder="ООО Поставщик"
                                />
                            </div>
                            <div>
                                <label className={`block text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Контактное лицо</label>
                                <input
                                    value={form.contactPerson || ''}
                                    onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
                                    className={`w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                />
                            </div>
                            <div>
                                <label className={`block text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Телефон</label>
                                <input
                                    value={form.phone || ''}
                                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                                    className={`w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                />
                            </div>
                            <div>
                                <label className={`block text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Email</label>
                                <input
                                    value={form.email || ''}
                                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                                    className={`w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className={`block text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Адрес</label>
                                <input
                                    value={form.address || ''}
                                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                                    className={`w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className={`block text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Примечания</label>
                                <input
                                    value={form.notes || ''}
                                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                                    className={`w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                />
                            </div>
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                onClick={() => { setShowCreate(false); setForm({ name: '' }); setError(null); }}
                                className={`px-4 py-2 rounded-lg ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
                                disabled={creating}
                            >
                                Отмена
                            </button>
                            <button
                                onClick={async () => {
                                    if (!form.name.trim()) { setError('Укажите название поставщика'); return; }
                                    try {
                                        setCreating(true);
                                        setError(null);
                                        const res = await api.suppliers.create({
                                            name: form.name.trim(),
                                            contactPerson: form.contactPerson?.trim() || undefined,
                                            phone: form.phone?.trim() || undefined,
                                            email: form.email?.trim() || undefined,
                                            address: form.address?.trim() || undefined,
                                            notes: form.notes?.trim() || undefined,
                                        });
                                        if ((res as any).success) {
                                            const created = (res as any).data as SupplierItem;
                                            setSuppliers((prev) => [created, ...prev]);
                                            setShowCreate(false);
                                            setForm({ name: '' });
                                        }
                                    } catch (e: any) {
                                        setError(e?.message || 'Ошибка создания поставщика');
                                    } finally {
                                        setCreating(false);
                                    }
                                }}
                                className={`px-4 py-2 rounded-lg font-medium ${isDark ? 'bg-emerald-700 hover:bg-emerald-600 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                                disabled={creating}
                            >
                                {creating ? 'Сохранение...' : 'Сохранить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuppliersPage;
