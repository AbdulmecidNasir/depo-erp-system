import React from 'react';
import { CheckCircle, Clock, Truck, FileText, CreditCard, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface DocumentRelationsProps {
    order: any;
    currentId?: string; // ID of the currently viewed document to highlight
}

const DocumentRelations: React.FC<DocumentRelationsProps> = ({ order, currentId }) => {
    if (!order) return null;

    // Helper to check if a document is the current one
    const isCurrent = (id: string) => id === currentId;

    // 1. Order Node Data
    const orderNode = {
        id: order.id || order._id,
        type: 'Заказ покупателя',
        number: order.orderNumber,
        date: order.createdAt,
        amount: order.total,
        status: order.status === 'delivered' || order.status === 'completed' ? 'Доставлен' : 'В процессе',
        isCompleted: true, // Order is always the start
        icon: <FileText size={16} />
    };

    const shipments = order.shipments || [];
    const payments = order.payments || [];

    // Handle Returns
    // If backend provides `returns` array, use it. Otherwise, infer from status.
    const returns = order.returns || [];
    if (returns.length === 0 && (order.status === 'returned' || order.status === 'partially_returned')) {
        returns.push({
            _id: `${order.id || order._id}_return`,
            returnNumber: `${order.orderNumber}-R`,
            createdAt: order.updatedAt || order.createdAt || new Date().toISOString(),
            total: order.total, // approx
            status: order.status === 'returned' ? 'Возврат' : 'Частичный возврат'
        });
    }

    return (
        <div className="p-4 overflow-x-auto">
            <h3 className="text-sm font-bold text-gray-500 mb-4 px-1">Связанные документы (Цепочка сделки)</h3>
            <div className="flex items-start gap-2 min-w-max pb-2">

                {/* ORDER NODE */}
                <DocumentCard
                    data={orderNode}
                    isActive={isCurrent(order.id || order._id)}
                    dark={isCurrent(order.id || order._id)}
                    color="border-l-4 border-l-blue-500"
                />

                {/* SEPARATOR */}
                <div className="flex items-center justify-center h-24 text-gray-300">
                    <div className="w-8 border-t-2 border-dashed border-gray-300 relative">
                        <div className="absolute -top-1.5 -right-1 text-gray-300">●</div>
                        <div className="absolute -top-1.5 -left-1 text-gray-300">●</div>
                    </div>
                </div>

                {/* SHIPMENTS NODES */}
                <div className="flex flex-col gap-4">
                    {shipments.length === 0 ? (
                        <div className="opacity-50 border-2 border-dashed border-gray-300 rounded-lg p-4 w-48 h-24 flex items-center justify-center text-sm text-gray-400">
                            Нет отгрузок
                        </div>
                    ) : (
                        shipments.map((shipment: any, idx: number) => (
                            <DocumentCard
                                key={shipment._id || `shipment-${idx}`}
                                isActive={isCurrent(shipment._id)}
                                data={{
                                    id: shipment._id,
                                    type: 'Отгрузка',
                                    number: shipment.shipmentNumber,
                                    date: shipment.createdAt,
                                    amount: orderNode.amount,
                                    status: 'ОТГРУЖЕНО',
                                    isCompleted: shipment.status !== 'draft',
                                    icon: <Truck size={16} />
                                }}
                                dark={isCurrent(shipment._id)}
                            />
                        ))
                    )}
                </div>

                {/* SEPARATOR */}
                {(returns.length > 0) && (
                    <>
                        <div className="flex items-center justify-center h-24 text-gray-300">
                            <div className="w-8 border-t-2 border-dashed border-gray-300 relative">
                                <div className="absolute -top-1.5 -right-1 text-gray-300">●</div>
                                <div className="absolute -top-1.5 -left-1 text-gray-300">●</div>
                            </div>
                        </div>

                        {/* RETURNS NODES */}
                        <div className="flex flex-col gap-4">
                            {returns.map((ret: any, idx: number) => (
                                <DocumentCard
                                    key={ret._id || `return-${idx}`}
                                    isActive={isCurrent(ret._id)}
                                    dark={isCurrent(ret._id)}
                                    data={{
                                        id: ret._id,
                                        type: 'Возврат',
                                        number: ret.returnNumber || (ret._id ? ret._id.slice(-6) : 'RET'),
                                        date: ret.createdAt,
                                        amount: ret.total || 0,
                                        status: 'ВОЗВРАТ',
                                        isCompleted: true,
                                        icon: <RotateCcw size={16} />
                                    }}
                                    color="border-l-4 border-l-red-500"
                                />
                            ))}
                        </div>
                    </>
                )}

                {/* SEPARATOR TO PAYMENTS */}
                <div className="flex items-center justify-center h-24 text-gray-300">
                    <div className="w-8 border-t-2 border-dashed border-gray-300 relative">
                        <div className="absolute -top-1.5 -right-1 text-gray-300">●</div>
                        <div className="absolute -top-1.5 -left-1 text-gray-300">●</div>
                    </div>
                </div>

                {/* PAYMENTS NODES */}
                <div className="flex flex-col gap-4">
                    {payments.length === 0 ? (
                        <div className="opacity-50 border-2 border-dashed border-gray-300 rounded-lg p-4 w-48 h-24 flex items-center justify-center text-sm text-gray-400">
                            Ожидание оплаты
                        </div>
                    ) : (
                        payments.map((payment: any, idx: number) => (
                            <DocumentCard
                                key={payment.id || payment._id || `payment-${idx}`}
                                isActive={isCurrent(payment.id || payment._id)}
                                dark={isCurrent(payment.id || payment._id)}
                                data={{
                                    id: payment.id || payment._id,
                                    type: 'Входящий платеж',
                                    number: payment.paymentNumber || (payment._id ? 'ПЛ-' + payment._id.slice(-4) : 'PAY'),
                                    date: payment.createdAt,
                                    amount: payment.amount,
                                    status: payment.status === 'pending' ? 'В ОБРАБОТКЕ' : (payment.status === 'cancelled' ? 'ОТМЕНЕН' : 'ПРОВЕДЕН'),
                                    isCompleted: payment.status === 'completed',
                                    icon: <CreditCard size={16} />
                                }}
                                color={payment.status === 'pending' ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-green-500"}
                            />
                        ))
                    )}
                </div>

            </div>
        </div>
    );
};

// Sub-component for individual card
const DocumentCard = ({ data, isActive, dark = false, color }: any) => {
    // Style classes based on state
    const baseClasses = "relative w-56 p-3 rounded shadow-sm border transition-all duration-200";
    const themeClasses = dark
        ? "bg-gray-800 text-white border-gray-700"
        : `bg-white text-gray-800 border-gray-200 hover:shadow-md ${color || ''}`;
    const activeRing = isActive ? "ring-2 ring-blue-500 ring-offset-2" : "";

    // Safe date parsing
    const safeDate = (dateVal: any) => {
        if (!dateVal) return null;
        const d = new Date(dateVal);
        return isNaN(d.getTime()) ? null : d;
    };

    const dateObj = safeDate(data.date);

    return (
        <div className={`${baseClasses} ${themeClasses} ${activeRing}`}>
            <div className="flex items-center gap-2 mb-2 border-b border-gray-200/20 pb-2">
                {data.isCompleted ? (
                    data.type === 'Возврат' ? <RotateCcw size={16} className="text-red-500" /> :
                        <CheckCircle size={16} className={dark ? "text-green-400" : "text-green-600"} />
                ) : <Clock size={16} className="text-amber-500" />}
                <span className="font-bold text-sm truncate">{data.type}</span>
            </div>

            <div className={`text-sm ${dark ? 'text-gray-300' : 'text-gray-600'} space-y-1`}>
                <div className="flex justify-between">
                    <span>№{data.number || '---'}</span>
                </div>
                <div className="text-xs opacity-75">
                    {dateObj ? format(dateObj, 'dd.MM.yyyy HH:mm', { locale: ru }) : '-'}
                </div>
                <div className="font-bold text-base mt-2">
                    {data.amount?.toLocaleString() || 0} сум/долл
                </div>
            </div>

            {data.status && (
                <div className={`mt-2 text-center text-xs font-bold uppercase py-1 px-2 rounded ${data.status === 'ВОЗВРАТ' ? 'bg-red-100 text-red-700' :
                    dark ? 'bg-orange-600 text-white' : 'bg-green-600 text-white'
                    }`}>
                    {data.status}
                </div>
            )}
        </div>
    );
};

export default DocumentRelations;
