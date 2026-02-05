import express from 'express';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { protect, restrictTo } from '../middleware/auth.js';
import Location from '../models/Location.js';

const router = express.Router();

// @desc    Get dashboard analytics
// @route   GET /api/analytics/dashboard
// @access  Private (Admin only)
router.get('/dashboard', protect, restrictTo('admin'), async (req, res) => {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));
    const startOfYesterday = new Date(yesterday.setHours(0, 0, 0, 0));
    const endOfYesterday = new Date(yesterday.setHours(23, 59, 59, 999));

    // Today's sales
    const todaySalesResult = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfToday, $lte: endOfToday },
          status: { $nin: ['cancelled'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Yesterday's sales
    const yesterdaySalesResult = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfYesterday, $lte: endOfYesterday },
          status: { $nin: ['cancelled'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Today's new customers
    const todayCustomers = await User.countDocuments({
      createdAt: { $gte: startOfToday, $lte: endOfToday },
      role: 'customer'
    });

    // Yesterday's new customers
    const yesterdayCustomers = await User.countDocuments({
      createdAt: { $gte: startOfYesterday, $lte: endOfYesterday },
      role: 'customer'
    });

    // Low stock products
    const lowStockProducts = await Product.find({
      $expr: { $lt: ['$stock', '$minStock'] },
      isActive: true
    }).select('nameRu brand model stock minStock').limit(10);

    // Out of stock products
    const outOfStockProducts = await Product.find({
      stock: 0,
      isActive: true
    }).select('nameRu brand model').limit(10);

    // Total products
    const totalProducts = await Product.countDocuments({ isActive: true });

    // Total customers
    const totalCustomers = await User.countDocuments({ role: 'customer' });

    // Recent orders
    const recentOrders = await Order.find()
      .populate('customer', 'firstName lastName')
      .populate('items.product', 'nameRu')
      .sort({ createdAt: -1 })
      .limit(5);

    // Sales by category (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const salesByCategory = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
          status: { $nin: ['cancelled'] }
        }
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: '$product.category',
          total: { $sum: '$items.total' },
          quantity: { $sum: '$items.quantity' }
        }
      },
      { $sort: { total: -1 } }
    ]);

    const todaySales = todaySalesResult[0]?.total || 0;
    const yesterdaySales = yesterdaySalesResult[0]?.total || 0;
    const todayOrdersCount = todaySalesResult[0]?.count || 0;
    const yesterdayOrdersCount = yesterdaySalesResult[0]?.count || 0;

    res.json({
      success: true,
      data: {
        sales: {
          today: todaySales,
          yesterday: yesterdaySales,
          change: yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales * 100) : 0
        },
        orders: {
          today: todayOrdersCount,
          yesterday: yesterdayOrdersCount,
          change: yesterdayOrdersCount > 0 ? ((todayOrdersCount - yesterdayOrdersCount) / yesterdayOrdersCount * 100) : 0
        },
        customers: {
          today: todayCustomers,
          yesterday: yesterdayCustomers,
          change: todayCustomers - yesterdayCustomers,
          total: totalCustomers
        },
        products: {
          total: totalProducts,
          lowStock: lowStockProducts.length,
          outOfStock: outOfStockProducts.length
        },
        lowStockProducts,
        outOfStockProducts,
        recentOrders,
        salesByCategory
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения аналитики'
    });
  }
});

// @desc    Get sales report
// @route   GET /api/analytics/sales
// @access  Private (Admin only)
router.get('/sales', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { startDate, endDate, period = 'daily' } = req.query;
    
    let start = startDate ? new Date(startDate) : new Date();
    let end = endDate ? new Date(endDate) : new Date();
    
    // Default to last 30 days if no dates provided
    if (!startDate && !endDate) {
      start.setDate(start.getDate() - 30);
    }

    let groupBy;
    let dateFormat;

    switch (period) {
      case 'hourly':
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
          hour: { $hour: '$createdAt' }
        };
        dateFormat = '%Y-%m-%d %H:00';
        break;
      case 'weekly':
        groupBy = {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' }
        };
        dateFormat = '%Y-W%U';
        break;
      case 'monthly':
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        dateFormat = '%Y-%m';
        break;
      default: // daily
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
        dateFormat = '%Y-%m-%d';
    }

    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: { $nin: ['cancelled'] }
        }
      },
      {
        $group: {
          _id: groupBy,
          totalSales: { $sum: '$total' },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: '$total' }
        }
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
              hour: '$_id.hour'
            }
          }
        }
      },
      { $sort: { date: 1 } }
    ]);

    res.json({
      success: true,
      data: salesData
    });
  } catch (error) {
    console.error('Get sales report error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения отчета по продажам'
    });
  }
});

// @desc    Get product performance
// @route   GET /api/analytics/products
// @access  Private (Admin only)
router.get('/products', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { limit = 20, sortBy = 'revenue' } = req.query;

    let sortField;
    switch (sortBy) {
      case 'quantity':
        sortField = { totalQuantity: -1 };
        break;
      case 'orders':
        sortField = { orderCount: -1 };
        break;
      case 'views':
        sortField = { views: -1 };
        break;
      default: // revenue
        sortField = { totalRevenue: -1 };
    }

    // Get product performance from orders
    const productPerformance = await Order.aggregate([
      {
        $match: {
          status: { $nin: ['cancelled'] }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalRevenue: { $sum: '$items.total' },
          totalQuantity: { $sum: '$items.quantity' },
          orderCount: { $sum: 1 },
          avgPrice: { $avg: '$items.price' }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          _id: 1,
          nameRu: '$product.nameRu',
          brand: '$product.brand',
          model: '$product.model',
          category: '$product.category',
          currentStock: '$product.stock',
          views: '$product.views',
          totalRevenue: 1,
          totalQuantity: 1,
          orderCount: 1,
          avgPrice: 1
        }
      },
      { $sort: sortField },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: productPerformance
    });
  } catch (error) {
    console.error('Get product performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения производительности продуктов'
    });
  }
});

// @desc    Export analytics data
// @route   GET /api/analytics/export
// @access  Private (Admin only)
router.get('/export', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { type = 'products', format = 'json' } = req.query;

    let data;
    let filename;

    switch (type) {
      case 'orders':
        data = await Order.find()
          .populate('customer', 'firstName lastName email')
          .populate('items.product', 'nameRu brand model')
          .sort({ createdAt: -1 });
        filename = 'orders_export';
        break;
      case 'customers':
        data = await User.find({ role: 'customer' })
          .select('firstName lastName email createdAt lastLogin')
          .sort({ createdAt: -1 });
        filename = 'customers_export';
        break;
      default: // products
        data = await Product.find({ isActive: true })
          .select('nameRu brand model category stock salePrice purchasePrice location createdAt')
          .sort({ createdAt: -1 });
        filename = 'products_export';
    }

    if (format === 'csv') {
      // Convert to CSV format
      let csv = '';
      if (data.length > 0) {
        // Headers
        const headers = Object.keys(data[0].toObject ? data[0].toObject() : data[0]);
        csv += headers.join(',') + '\n';
        
        // Data rows
        data.forEach(item => {
          const values = headers.map(header => {
            const value = item[header];
            return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
          });
          csv += values.join(',') + '\n';
        });
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    } else {
      res.json({
        success: true,
        data,
        exportedAt: new Date().toISOString(),
        count: data.length
      });
    }
  } catch (error) {
    console.error('Export analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка экспорта данных'
    });
  }
});

// New: Turnover by locations
// @desc    Get turnover by locations (sum of order items total grouped by product.location)
// @route   GET /api/analytics/locations/turnover
// @access  Private (Admin only)
router.get('/locations/turnover', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { startDate, endDate, limit } = req.query;

    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const pipeline = [
      { $match: { status: { $nin: ['cancelled'] }, ...dateFilter } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: '$product.location',
          turnover: { $sum: '$items.total' },
          quantity: { $sum: '$items.quantity' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { turnover: -1 } },
    ];

    if (limit) {
      pipeline.push({ $limit: parseInt(limit) });
    }

    const result = await Order.aggregate(pipeline);

    // Optionally enrich with location name if exists
    const codes = result.map(r => r._id).filter(Boolean);
    const locations = await Location.find({ code: { $in: codes } }).select('code name zone').lean();
    const locMap = new Map(locations.map(l => [l.code, l]));

    const data = result.map(r => ({
      code: r._id || 'UNKNOWN',
      name: locMap.get(r._id)?.name || r._id || 'UNKNOWN',
      zone: locMap.get(r._id)?.zone,
      turnover: r.turnover,
      quantity: r.quantity,
      orders: r.orders,
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get locations turnover error:', error);
    res.status(500).json({ success: false, message: 'Ошибка получения оборота по локациям' });
  }
});

// @desc    Get location-based turnover time series
// @route   GET /api/analytics/locations/timeseries
// @query   startDate, endDate, period=daily|weekly|monthly, locations=code1,code2
// @access  Private (Admin only)
router.get('/locations/timeseries', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { startDate, endDate, period = 'daily', locations } = req.query;

    let start = startDate ? new Date(startDate) : new Date();
    let end = endDate ? new Date(endDate) : new Date();
    if (!startDate && !endDate) {
      start.setDate(start.getDate() - 30);
    }

    let groupSpec;
    switch (period) {
      case 'monthly':
        groupSpec = { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } };
        break;
      case 'weekly':
        groupSpec = { year: { $year: '$createdAt' }, week: { $week: '$createdAt' } };
        break;
      default:
        groupSpec = { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } };
    }

    const match = { createdAt: { $gte: start, $lte: end }, status: { $nin: ['cancelled'] } };

    const locationFilter = (locations ? String(locations).split(',').filter(Boolean) : []);

    const pipeline = [
      { $match: match },
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
    ];

    if (locationFilter.length) {
      pipeline.push({ $match: { 'product.location': { $in: locationFilter } } });
    }

    pipeline.push(
      { $group: { _id: { ...groupSpec, location: '$product.location' }, turnover: { $sum: '$items.total' } } },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } }
    );

    const rows = await Order.aggregate(pipeline);

    // Format to series: { date: 'YYYY-MM-DD', [locCode]: value }
    const byDate = new Map();
    const locSet = new Set();

    for (const r of rows) {
      const { year, month, day, week, location } = r._id;
      let dateKey;
      if (period === 'monthly') {
        dateKey = `${year}-${String(month).padStart(2, '0')}`;
      } else if (period === 'weekly') {
        dateKey = `${year}-W${String(week).padStart(2, '0')}`;
      } else {
        dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      if (!byDate.has(dateKey)) byDate.set(dateKey, { date: dateKey });
      byDate.get(dateKey)[location || 'UNKNOWN'] = r.turnover;
      locSet.add(location || 'UNKNOWN');
    }

    const series = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    const locationsList = Array.from(locSet);

    res.json({ success: true, data: { series, locations: locationsList } });
  } catch (error) {
    console.error('Get locations timeseries error:', error);
    res.status(500).json({ success: false, message: 'Ошибка получения динамики оборота по локациям' });
  }
});

export default router;