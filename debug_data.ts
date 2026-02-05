
import { api } from './src/services/api';

async function checkData() {
    try {
        console.log('Fetching stock movements...');
        const res = await api.stockMovements.getAll({ type: 'in', limit: 5 });
        if (res.success && res.data.length > 0) {
            console.log('Sample Movement:', JSON.stringify(res.data[0], null, 2));
            const m = res.data[0];
            console.log('Movement Supplier:', m.supplierId || m.supplier);
            console.log('Product Supplier:', m.productId?.supplierId || m.productId?.supplier);
        } else {
            console.log('No stock movements found.');
        }

        console.log('Fetching suppliers...');
        const sRes = await api.suppliers.getAll({ limit: 1 });
        if (sRes.success && sRes.data.length > 0) {
            console.log('Sample Supplier:', JSON.stringify(sRes.data[0], null, 2));
        }

    } catch (e) {
        console.error(e);
    }
}

checkData();
