
import { api } from './src/services/api';

async function checkDebug() {
    try {
        console.log('--- PAYMENTS ---');
        // Fetch unlimited payments
        const pRes = await api.payments.getAll({ limit: 10 });
        if (pRes.success) {
            console.log('Payments Count:', pRes.data.length);
            if (pRes.data.length > 0) {
                console.log('Sample Payment:', JSON.stringify(pRes.data[0], null, 2));
            }
        }

        console.log('--- STOCK OUT ---');
        const mRes = await api.stockMovements.getAll({ type: 'out', limit: 5 });
        if (mRes.success) {
            console.log('Out Movements:', mRes.data.length);
            if (mRes.data.length > 0) {
                console.log('Sample Out:', JSON.stringify(mRes.data[0], null, 2));
            }
        }
    } catch (e) {
        console.error(e);
    }
}

checkDebug();
