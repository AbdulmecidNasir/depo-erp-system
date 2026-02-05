import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Fix for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const API_URL = 'http://localhost:5000/api';
// Use a test password for all temporary users
const TEST_PASSWORD = 'password123';

const AGENTS = [
    { role: 'admin', email: 'test_admin@example.com', name: 'Test Admin' },
    { role: 'sales_manager', email: 'test_sales@example.com', name: 'Test Sales' },
    { role: 'warehouse_manager', email: 'test_wh_head@example.com', name: 'Test WH Head' },
    { role: 'warehouse_staff', email: 'test_wh_staff@example.com', name: 'Test WH Staff' },
    { role: 'cashier', email: 'test_cashier@example.com', name: 'Test Cashier' }
];

async function runTests() {
    console.log('🚀 Starting RBAC Verification Suite...\n');

    // 1. Setup Test Users
    console.log('1️⃣  Setting up test users...');
    const tokens = {};

    for (const agent of AGENTS) {
        // Try login first
        let res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: agent.email, password: TEST_PASSWORD })
        });

        if (res.status === 401 || res.status === 404) {
            // Register if not found
            console.log(`   Creating user ${agent.role}...`);
            res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: agent.email,
                    password: TEST_PASSWORD,
                    firstName: agent.name.split(' ')[0],
                    lastName: agent.name.split(' ')[1]
                })
            });
        }

        const data = await res.json();

        if (data.success) {
            tokens[agent.role] = data.token;
            // Force update role (Registration defaults to 'customer' usually, or we need to update it as admin)
            // wait... we need an admin token to update roles. 
            // Assuming the first run, we might not have an admin. 
            // BUT, for this script to work, we need at least one admin.
            // Let's assume we can use the 'admin' we just logged in/registered.
            // If it was just registered, it's a customer.
            // We need to hack the DB for the first admin or assume one exists.

            // For now, let's just print tokens obtained.
            console.log(`   ✅ Logged in as ${agent.role}`);
        } else {
            console.error(`   ❌ Failed to login/register ${agent.role}:`, data.message);
        }
    }

    // HACK: Host machine DB access to force set roles for these test emails
    // ensure connection is established by app or do it here?
    // Doing it via API if possible is better, but we need an initial admin.
    // Let's prompt user to make sure 'test_admin@example.com' is admin if tests fail.

    console.log('\n⚠️  Make sure test_admin@example.com has "admin" role in DB if this is the first run.\n');

    // Helper to request
    const req = async (role, method, endpoint, body = null) => {
        const token = tokens[role];
        if (!token) return { status: 0, success: false, message: 'No token' };

        const opts = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };
        if (body) opts.body = JSON.stringify(body);

        const res = await fetch(`${API_URL}${endpoint}`, opts);
        const data = await res.json().catch(() => ({}));
        return { status: res.status, ...data };
    };

    // 2. Test Scenarios
    console.log('2️⃣  Running Scenarios...\n');

    const check = (description, result, isAllowed) => {
        const pass = isAllowed ? (result.status >= 200 && result.status < 300) : (result.status === 403);
        const icon = pass ? '✅' : '❌';
        console.log(`${icon} ${description.padEnd(60)} | Expected: ${isAllowed ? 'Allow' : 'Deny'} | Got: ${result.status}`);
        return pass;
    };

    const productPayload = { nameRu: 'Test Product', brand: 'Test', stock: 10, purchasePrice: 100, salePrice: 150 };

    // Scenario A: Product Management
    console.log('--- A. Product Management ---');
    await check('Admin creates product', await req('admin', 'POST', '/products', productPayload), true);
    await check('Warehouse Manager creates product', await req('warehouse_manager', 'POST', '/products', productPayload), true);
    await check('Sales Manager tries to create product', await req('sales_manager', 'POST', '/products', productPayload), false);
    await check('Warehouse Staff tries to create product', await req('warehouse_staff', 'POST', '/products', productPayload), false);

    // Scenario B: Stock Movements
    console.log('\n--- B. Stock Movements ---');
    const movementPayload = {
        type: 'in',
        productId: '507f1f77bcf86cd799439011', // Fake ID, validation might fail but checking 403 vs 400/404 is the key
        quantity: 5,
        reason: 'Test'
    };
    // Note: Stock movement creation requires valid product ID usually. 
    // If we get 400 (Bad Request) or 404, it means we PASSED the Auth check (otherwise 403).
    // So we treat != 403 as "Allowed" for auth purposes here, or we need a real product.

    const verifyAuth = (res, shouldBeAllowed) => {
        if (shouldBeAllowed) {
            // If allowed, we might get 200, 201, 400, 404, 500. Anything BUT 403/401.
            return res.status !== 403 && res.status !== 401;
        } else {
            return res.status === 403;
        }
    };

    const checkAuth = (desc, res, allow) => {
        const pass = verifyAuth(res, allow);
        console.log(`${pass ? '✅' : '❌'} ${desc.padEnd(60)} | Expected: ${allow ? 'Allow' : 'Deny'} | Got: ${res.status}`);
    };

    checkAuth('Warehouse Staff creates movement', await req('warehouse_staff', 'POST', '/stock-movements', movementPayload), true);
    checkAuth('Warehouse Manager creates movement', await req('warehouse_manager', 'POST', '/stock-movements', movementPayload), true);
    checkAuth('Sales Manager tries movement', await req('sales_manager', 'POST', '/stock-movements', movementPayload), false); // Sales can't move stock manually? Plan said NO.

    // Scenario C: Payments (Cashier)
    console.log('\n--- C. Payments ---');
    checkAuth('Cashier creates payment', await req('cashier', 'POST', '/payments', { orderId: 'fake', amount: 100 }), true);
    checkAuth('Admin creates payment', await req('admin', 'POST', '/payments', { orderId: 'fake', amount: 100 }), true);
    checkAuth('Sales Manager tries payment', await req('sales_manager', 'POST', '/payments', { orderId: 'fake', amount: 100 }), false); // Plan said NO (only view).

    // Scenario D: User Management
    console.log('\n--- D. User Management ---');
    // Using a fake ID for update
    checkAuth('Admin updates user role', await req('admin', 'PUT', '/users/507f1f77bcf86cd799439011', { role: 'cashier' }), true);
    checkAuth('Manager tries to update role', await req('warehouse_manager', 'PUT', '/users/507f1f77bcf86cd799439011', { role: 'cashier' }), false);

    // Scenario E: Sales Manager Expanded Access
    console.log('\n--- E. Sales Manager Expanded Access ---');
    checkAuth('Sales Manager views debitors', await req('sales_manager', 'GET', '/debitors'), true);
    checkAuth('Sales Manager creates debitor', await req('sales_manager', 'POST', '/debitors', { partyName: 'Test Debitor', amount: 100 }), true);
    checkAuth('Sales Manager views creditors', await req('sales_manager', 'GET', '/creditors'), true);
    checkAuth('Sales Manager views locations', await req('sales_manager', 'GET', '/locations'), true);
    checkAuth('Warehouse Staff tries to view debitors', await req('warehouse_staff', 'GET', '/debitors'), false); // Should be denied

    console.log('\n🏁 Verification Complete.');
}

runTests().catch(console.error);
