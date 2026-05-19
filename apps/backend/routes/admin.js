import express from "express";
import pool from "../db.js";
import { authenticateToken, isAdmin } from "../middleware/auth.js";

const router = express.Router();

/**
 * GET /api/admin/statistics
 * Thống kê dòng tiền và doanh thu cho bảng điều khiển Admin theo logic kinh doanh mới.
 */
router.get("/statistics", authenticateToken, isAdmin, async (req, res) => {
  try {
    // 1. Nhận tham số 'days' (mặc định là 7 ngày nếu không truyền)
    let days = req.query.days;
    if (days === "all") {
      days = 36500; // 100 năm (toàn thời gian)
    } else {
      days = parseInt(days, 10) || 7;
      if (isNaN(days) || days <= 0) {
        return res.status(400).json({ 
          success: false, 
          message: "Tham số 'days' không hợp lệ. Phải là một số nguyên dương hoặc 'all'." 
        });
      }
    }

    // 2. Nhóm A: Tổng quan (Summary)
    // Tích hợp gộp cả chữ hoa/thường và các định danh thực tế trong DB
    const summaryQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN purpose IN ('DEPOSIT', 'deposit', 'mock_deposit') THEN amount ELSE 0 END), 0) AS totalDeposit,
        COALESCE(SUM(CASE WHEN purpose IN ('COMMISSION', 'commission') THEN amount ELSE 0 END), 0) AS revenueCommission,
        COALESCE(SUM(CASE WHEN purpose IN ('PIN_POST', 'pin_post', 'boost_pin') THEN amount ELSE 0 END), 0) AS revenuePinPost,
        COALESCE(SUM(CASE WHEN purpose IN ('UPGRADE_ROLE', 'upgrade_role', 'upgrade_dealer') THEN amount ELSE 0 END), 0) AS revenueUpgrade
      FROM wallet_transactions
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `;

    // 3. Nhóm B: Thống kê theo Role (Biểu đồ tròn)
    // Tính tổng tiền nạp (DEPOSIT) và gom nhóm theo vai trò (FARMER, BUYER, DEALER)
    const roleStatsQuery = `
      SELECT 
        UPPER(u.role) AS role,
        COALESCE(SUM(wt.amount), 0) AS totalDeposited
      FROM wallet_transactions wt
      JOIN users u ON wt.user_id = u.id
      WHERE wt.purpose IN ('DEPOSIT', 'deposit', 'mock_deposit')
        AND wt.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY u.role
    `;

    // 4. Nhóm C: Thống kê theo Ngày (Biểu đồ đường)
    // Tính dailyDeposit và dailyRevenue (doanh thu tổng cộng của cả COMMISSION, PIN_POST, UPGRADE_ROLE)
    const chartDataQuery = `
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d') AS date,
        COALESCE(SUM(CASE WHEN purpose IN ('DEPOSIT', 'deposit', 'mock_deposit') THEN amount ELSE 0 END), 0) AS dailyDeposit,
        COALESCE(SUM(CASE WHEN purpose IN ('COMMISSION', 'commission', 'PIN_POST', 'pin_post', 'boost_pin', 'UPGRADE_ROLE', 'upgrade_role', 'upgrade_dealer') THEN amount ELSE 0 END), 0) AS dailyRevenue
      FROM wallet_transactions
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
      ORDER BY date ASC
    `;

    // 5. Thực thi song song tối ưu với Promise.all
    const [
      [summaryRows],
      [roleRows],
      [chartRows]
    ] = await Promise.all([
      pool.query(summaryQuery, [days]),
      pool.query(roleStatsQuery, [days]),
      pool.query(chartDataQuery, [days])
    ]);

    // Trích xuất dữ liệu tổng quan
    const totalDeposit = Number(summaryRows[0].totalDeposit);
    const commission = Number(summaryRows[0].revenueCommission);
    const pinPost = Number(summaryRows[0].revenuePinPost);
    const upgradeRole = Number(summaryRows[0].revenueUpgrade);
    
    // Doanh thu thực của sàn = Commission + PinPost + Upgrade
    const totalRevenue = commission + pinPost + upgradeRole;

    const summary = {
      totalDeposit,
      revenueBreakdown: {
        commission,
        pinPost,
        upgradeRole
      },
      totalRevenue
    };

    // Định dạng nhóm B: Thống kê theo vai trò (Chuẩn hóa các role 'USER' sang 'FARMER' để khớp front-end)
    const roleStats = roleRows.map(row => {
      let roleLabel = row.role;
      if (roleLabel === 'USER') {
        roleLabel = 'FARMER';
      }
      return {
        role: roleLabel,
        totalDeposited: Number(row.totalDeposited)
      };
    });

    // Định dạng nhóm C: Thống kê theo ngày để vẽ biểu đồ đường
    const chartData = chartRows.map(row => ({
      date: row.date,
      deposit: Number(row.dailyDeposit),
      revenue: Number(row.dailyRevenue)
    }));

    // Trả về JSON đúng cấu trúc yêu cầu
    res.json({
      success: true,
      data: {
        summary,
        roleStats,
        chartData
      }
    });

  } catch (error) {
    console.error("❌ Lỗi khi cập nhật API GET /api/admin/statistics:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server nội bộ khi lấy thống kê admin", 
      error: error.message 
    });
  }
});

export default router;
