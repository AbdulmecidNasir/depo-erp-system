import mongoose from 'mongoose';
import CountSession from '../models/CountSession.js';
import CountLine from '../models/CountLine.js';
import Inventory from '../models/Inventory.js';
import Product from '../models/Product.js';
import Location from '../models/Location.js';
import StockMovement from '../models/StockMovement.js';

// --- Helper Functions ---

const generateSessionCode = async () => {
    const dateStr = new Date().toISOString().slice(0, 7).replace('-', ''); // YYYYMM
    const count = await CountSession.countDocuments({
        sessionCode: { $regex: `^CNT-${dateStr}` }
    });
    return `CNT-${dateStr}-${String(count + 1).padStart(3, '0')}`;
};

// --- Controllers ---

/**
 * @desc    Senkronizasyon: Product verilerini Inventory koleksiyonuna taşır
 * @route   POST /api/inventory/sync
 */
export const syncInventory = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const products = await Product.find({ isActive: true });
        let syncedCount = 0;

        for (const prod of products) {
            // 1. Ana Lokasyon Stoğu
            if (prod.location && prod.stock > 0) { // Sadece stoğu olan veya lokasyonu olanlar
                let loc = await Location.findOne({ code: prod.location }).session(session);

                // Lokasyon yoksa (veya string girildiyse) otomatik oluşturmaya çalış veya atla
                if (!loc) {
                    // Basit bir oluşturma mantığı, idealde önceden tanımlı olmalı
                    loc = await Location.create([{
                        code: prod.location,
                        name: prod.location,
                        zone: 'A', // Varsayılan
                        level: 1,
                        section: 1,
                        capacity: 1000
                    }], { session });
                    loc = loc[0];
                }

                if (loc) {
                    await Inventory.findOneAndUpdate(
                        { product: prod._id, location: loc._id },
                        {
                            $set: {
                                quantity: prod.stock, // Bu basitleştirilmiş, locationStock varsa o öncelikli olmalı
                                lastMovementDate: new Date()
                            }
                        },
                        { upsert: true, new: true, session }
                    );
                    syncedCount++;
                }
            }

            // 2. LocationStock Map'i (Varsa buradaki detay daha doğrudur)
            if (prod.locationStock && prod.locationStock.size > 0) {
                for (const [locCode, qty] of prod.locationStock.entries()) {
                    let loc = await Location.findOne({ code: locCode }).session(session);
                    if (!loc) {
                        loc = await Location.create([{
                            code: locCode,
                            name: locCode,
                            zone: 'A',
                            level: 1,
                            section: 1,
                            capacity: 1000
                        }], { session });
                        loc = loc[0];
                    }

                    if (loc) {
                        await Inventory.findOneAndUpdate(
                            { product: prod._id, location: loc._id },
                            { $set: { quantity: qty, lastMovementDate: new Date() } },
                            { upsert: true, session }
                        );
                    }
                }
            }
        }

        await session.commitTransaction();
        res.json({ success: true, message: `${syncedCount} ürün stoğu Inventory tablosuna eşitlendi.` });
    } catch (error) {
        await session.abortTransaction();
        console.error('Inventory Sync Error:', error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
};

/**
 * @desc    Yeni Sayım Oturumu Başlat
 * @route   POST /api/counts/sessions
 */
export const createSession = async (req, res) => {
    const { type, scope, description, assignedUsers } = req.body;

    // Scope Validasyon ve Query Hazırlama
    const inventoryQuery = {};

    // Eğer Zone/Raf filtresi varsa önce Location ID'lerini bul
    let locationIds = [];
    if (scope?.zones && scope.zones.length > 0) {
        const locations = await Location.find({ zone: { $in: scope.zones } }).select('_id');
        locationIds = locations.map(l => l._id);
    }

    if (scope?.locationCodes && scope.locationCodes.length > 0) {
        const specificLocs = await Location.find({ code: { $in: scope.locationCodes } }).select('_id');
        const specificIds = specificLocs.map(l => l._id);

        if (locationIds.length > 0) {
            // Intersection if both provided (unlikely but safe)
            locationIds = locationIds.filter(id => specificIds.some(sid => sid.toString() === id.toString()));
        } else {
            locationIds = specificIds;
        }
    }

    if (locationIds.length > 0 || (scope?.zones?.length > 0 || scope?.locationCodes?.length > 0)) {
        // If filters were applied but no locations found, we should probably match nothing or just the empty list found
        inventoryQuery.location = { $in: locationIds };
    }

    // Ürün filtresi (Category, ABC Class)
    if ((scope?.abcClasses && scope.abcClasses.length > 0) || (scope?.categories && scope.categories.length > 0)) {
        const productQuery = {};
        if (scope.abcClasses?.length) productQuery.abcClass = { $in: scope.abcClasses };
        if (scope.categories?.length) productQuery.category = { $in: scope.categories }; // Slug match

        const products = await Product.find(productQuery).select('_id');
        inventoryQuery.product = { $in: products.map(p => p._id) };
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const sessionCode = await generateSessionCode();

        const newSession = await CountSession.create([{
            sessionCode,
            type,
            scope,
            description,
            assignedUsers, // [userId, userId]
            createdBy: req.user._id,
            status: 'active', // Direkt aktif yapıyoruz, 'planned' adımı atlanabilir
            startedAt: new Date(),
            stats: { totalLines: 0 }
        }], { session });

        // Inventory'den snapshot al
        const inventories = await Inventory.find(inventoryQuery).session(session);

        if (inventories.length === 0) {
            // Eğer inventory boşsa (ilk kurulum), CountLine oluşturulamaz.
            // Kullanıcıya uyarı dönebiliriz veya boş session açabiliriz.
        }

        const countLines = inventories.map(inv => ({
            session: newSession[0]._id,
            product: inv.product,
            location: inv.location,
            systemQty: inv.quantity, // SNAPSHOT (Kilit Anı)
            batchNumber: inv.batchNumber
        }));

        if (countLines.length > 0) {
            await CountLine.insertMany(countLines, { session });

            // İstatistik güncelle
            newSession[0].stats.totalLines = countLines.length;
            await newSession[0].save({ session });
        }

        await session.commitTransaction();

        res.status(201).json({
            success: true,
            data: newSession[0],
            lineCount: countLines.length,
            message: `Sayım oturumu oluşturuldu. ${countLines.length} satır eklendi.`
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Create Session Error:', error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
};

/**
 * @desc    Sayım Satırlarını Getir (Filtreli)
 * @route   GET /api/counts/:sessionId/lines
 */
export const getSessionLines = async (req, res) => {
    try {
        const { page = 1, limit = 50, status } = req.query;
        const skip = (page - 1) * limit;
        const query = { session: req.params.sessionId };

        if (status === 'counted') query.countedQty = { $ne: null };
        if (status === 'uncounted') query.countedQty = null;
        if (status === 'discrepancy') query.isDiscrepancy = true;

        const lines = await CountLine.find(query)
            .populate('product', 'name nameRu brand model barcode image')
            .populate('location', 'code zone') // Lokasyon kodunu göster
            .skip(skip)
            .limit(Number(limit))
            .lean(); // Performans için lean

        // Eğer kullanıcı admin değilse systemQty'i gizle (BLIND COUNT)
        if (req.user.role !== 'admin') {
            lines.forEach(line => {
                delete line.systemQty;
                delete line.diffQty;
                delete line.isDiscrepancy;
            });
        }

        const total = await CountLine.countDocuments(query);
        const sessionDoc = await CountSession.findById(req.params.sessionId);

        res.json({
            success: true,
            session: sessionDoc,
            data: lines,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Sayım Girişi Yap (Toplu veya Tekil)
 * @route   POST /api/counts/:sessionId/lines
 */
export const addCountLines = async (req, res) => {
    const { lines } = req.body; // [{ _id: lineId, countedQty: 10 }, ...] veya productId+locationId bazlı

    try {
        const sessionDoc = await CountSession.findById(req.params.sessionId);
        if (sessionDoc.status !== 'active' && sessionDoc.status !== 'counting') {
            return res.status(400).json({ success: false, message: 'Bu oturum sayıma kapalı.' });
        }

        // Toplu işlem performans için
        const updates = [];

        for (const line of lines) {
            // line._id varsa doğrudan update, yoksa product+location ile bul
            const filter = line._id
                ? { _id: line._id }
                : { session: req.params.sessionId, product: line.productId, location: line.locationId };

            // Logic: isDiscrepancy hesapla
            // Önce mevcut line'ı bulmak gerek (systemQty için)
            // Bu adım bulkWrite içinde zor, tek tek dönüyoruz
            const currentLine = await CountLine.findOne(filter);
            if (!currentLine) continue;

            const diff = line.countedQty - currentLine.systemQty;

            currentLine.countedQty = line.countedQty;
            currentLine.diffQty = diff;
            currentLine.isDiscrepancy = (diff !== 0);
            currentLine.countedAt = new Date();
            currentLine.countedBy = req.user._id;

            updates.push(currentLine.save());
        }

        await Promise.all(updates);

        res.json({ success: true, message: `${updates.length} satır güncellendi.` });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Sayımı İncelemeye Gönder (Submit)
 * @route   PATCH /api/counts/:sessionId/submit
 */
export const submitSession = async (req, res) => {
    try {
        const countSession = await CountSession.findById(req.params.sessionId);

        // Kontrol: Sayılmayan satır var mı?
        const uncounted = await CountLine.countDocuments({ session: countSession._id, countedQty: null });
        if (uncounted > 0) {
            // Uyarı dönebiliriz veya izin verebiliriz (varsayılan 0 kabul edilebilir)
            // Şimdilik uyarı dönelim
            return res.status(400).json({ success: false, message: `Hala sayılmamış ${uncounted} satır var. Lütfen hepsini girin.` });
        }

        countSession.status = 'review';
        await countSession.save();

        res.json({ success: true, message: 'Sayım incelemeye gönderildi.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Onayla ve Düzeltmeleri İşle (Approve)
 * @route   POST /api/counts/:sessionId/approve
 */
export const approveSession = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const countSession = await CountSession.findById(req.params.sessionId).session(session);
        if (countSession.status !== 'review') {
            throw new Error('Sadece inceleme aşamasındaki sayımlar onaylanabilir.');
        }

        const discrepantLines = await CountLine.find({
            session: countSession._id,
            isDiscrepancy: true
        }).populate('location').session(session);

        const movementIdBase = await StockMovement.generateMovementId();
        // Not: generateMovementId unique döner, döngüde +1 yapmamız gerekebilir veya her biri için ayrı çağrılmalı
        // Basitlik için her satıra ayrı create çağıracağız, StockMovement modelindeki pre-save handle eder.

        for (const line of discrepantLines) {
            // Fark yoksa atla
            if (line.diffQty === 0) continue;

            const isPositive = line.diffQty > 0;
            const quantity = Math.abs(line.diffQty);
            const locCode = line.location.code;

            // 1. StockMovement Oluştur
            const movement = new StockMovement({
                productId: line.product,
                type: 'adjustment',
                quantity: quantity,
                // Eğer pozitif fark (Bulunan > Sistem) -> Stok Girişi (In) -> toLocation
                // Eğer negatif fark (Bulunan < Sistem) -> Stok Çıkışı (Out) -> fromLocation
                fromLocation: isPositive ? undefined : locCode,
                toLocation: isPositive ? locCode : undefined,
                userId: req.user._id,
                notes: `Sayım Farkı: ${countSession.sessionCode}`,
                status: 'completed',
                timestamp: new Date()
            });

            // pre('save') hook movementId üretecek
            await movement.save({ session });

            // 2. Inventory Güncelle
            // Doğrudan sayılan değere set ediyoruz (en güvenlisi)
            await Inventory.findOneAndUpdate(
                { product: line.product, location: line.location._id },
                {
                    $set: {
                        quantity: line.countedQty,
                        lastCountDate: new Date()
                    }
                },
                { session }
            );

            // 3. Product Toplam Stok Güncelle
            // Eğer Product.stock, tüm lokasyonların toplamı ise, bu da güncellenmeli.
            // diffQty kadar artır/azalt
            await Product.findByIdAndUpdate(
                line.product,
                { $inc: { stock: line.diffQty } },
                { session }
            );
        }

        countSession.status = 'approved';
        countSession.approvedBy = req.user._id;
        countSession.completedAt = new Date();
        countSession.stats.discrepancyLines = discrepantLines.length;

        await countSession.save({ session });

        await session.commitTransaction();
        res.json({ success: true, message: 'Sayım onaylandı, stoklar güncellendi.', adjustmentCount: discrepantLines.length });

    } catch (error) {
        await session.abortTransaction();
        console.error('Approve Error:', error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
};
